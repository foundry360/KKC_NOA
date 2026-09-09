import type {
  AdmissionEvent,
  CanonicalCoverage,
  CanonicalDiagnosis,
  CanonicalFacility,
  CanonicalHumanName,
  CanonicalPatient,
  CanonicalPayer,
  CanonicalProvider,
} from "@/src/domain/admission/admission-event";
import type { NormalizationService } from "@/src/domain/ports";
import type { CorrelationId, UUID } from "@/src/domain/types";
import {
  asBundle,
  extractResources,
  findResource,
  findResources,
  getNestedString,
  isObject,
  resolveReference,
  type FhirResource,
} from "../fhir/bundle-utils";
import { inferPayerType, mapEncounterClass } from "../fhir/validator";

function readName(resource?: FhirResource): CanonicalHumanName {
  const names = Array.isArray(resource?.name) ? resource.name : [];
  const primary = names.find(isObject) ?? {};
  const family = typeof primary.family === "string" ? primary.family : undefined;
  const given = Array.isArray(primary.given)
    ? primary.given.filter((g): g is string => typeof g === "string")
    : undefined;
  const text = typeof primary.text === "string" ? primary.text : undefined;
  return { family, given, text };
}

function readIdentifiers(
  resource?: FhirResource
): Array<{ system?: string; value: string }> {
  const identifiers = Array.isArray(resource?.identifier) ? resource.identifier : [];
  return identifiers
    .filter(isObject)
    .map((ident) => ({
      system: typeof ident.system === "string" ? ident.system : undefined,
      value: typeof ident.value === "string" ? ident.value : "",
    }))
    .filter((ident) => ident.value);
}

function npiFrom(resource?: FhirResource): string | undefined {
  return readIdentifiers(resource).find((i) =>
    (i.system ?? "").includes("us-npi")
  )?.value;
}

function mapPatient(patient?: FhirResource): CanonicalPatient {
  const identifiers = readIdentifiers(patient);
  const mrn = identifiers.find((i) => (i.system ?? "").includes("mrn"))?.value;
  return {
    id: patient?.id,
    mrn,
    name: readName(patient),
    birthDate:
      typeof patient?.birthDate === "string" ? patient.birthDate : undefined,
    gender: typeof patient?.gender === "string" ? patient.gender : undefined,
    identifiers,
  };
}

function mapFacility(
  resources: FhirResource[],
  encounter?: FhirResource
): CanonicalFacility {
  const serviceProvider = isObject(encounter?.serviceProvider)
    ? encounter.serviceProvider
    : undefined;
  const ref =
    serviceProvider && typeof serviceProvider.reference === "string"
      ? serviceProvider.reference
      : undefined;
  const org =
    resolveReference(resources, ref) ??
    findResources(resources, "Organization").find((o) => {
      const types = Array.isArray(o.type) ? o.type : [];
      return !types.some(
        (t) =>
          isObject(t) &&
          Array.isArray(t.coding) &&
          t.coding.some(
            (c) => isObject(c) && (c.code === "pay" || c.display === "Payer")
          )
      );
    });

  const addressRaw = Array.isArray(org?.address)
    ? org.address.find(isObject)
    : undefined;

  return {
    id: org?.id,
    npi: npiFrom(org),
    name: typeof org?.name === "string" ? org.name : undefined,
    address: addressRaw
      ? {
          line: Array.isArray(addressRaw.line)
            ? addressRaw.line.filter((l): l is string => typeof l === "string")
            : undefined,
          city: typeof addressRaw.city === "string" ? addressRaw.city : undefined,
          state:
            typeof addressRaw.state === "string" ? addressRaw.state : undefined,
          postalCode:
            typeof addressRaw.postalCode === "string"
              ? addressRaw.postalCode
              : undefined,
        }
      : undefined,
    type: "facility",
  };
}

function mapPayer(
  resources: FhirResource[],
  coverage?: FhirResource
): CanonicalPayer {
  const payors = Array.isArray(coverage?.payor) ? coverage.payor : [];
  const first = payors.find(isObject);
  const ref = first && typeof first.reference === "string" ? first.reference : undefined;
  const display = first && typeof first.display === "string" ? first.display : undefined;
  const org = resolveReference(resources, ref);
  return {
    id: org?.id,
    name: typeof org?.name === "string" ? org.name : display,
    payerType: inferPayerType(resources, coverage),
    identifiers: readIdentifiers(org),
  };
}

function mapCoverage(coverage?: FhirResource): CanonicalCoverage {
  const classes = Array.isArray(coverage?.class) ? coverage.class : [];
  const planClass = classes.find(isObject);
  const payors = Array.isArray(coverage?.payor) ? coverage.payor : [];
  const firstPayor = payors.find(isObject);
  return {
    id: coverage?.id,
    subscriberId:
      typeof coverage?.subscriberId === "string"
        ? coverage.subscriberId
        : undefined,
    status: typeof coverage?.status === "string" ? coverage.status : undefined,
    payorRef:
      firstPayor && typeof firstPayor.reference === "string"
        ? firstPayor.reference
        : undefined,
    plan:
      planClass && typeof planClass.value === "string"
        ? planClass.value
        : planClass && typeof planClass.name === "string"
          ? planClass.name
          : undefined,
  };
}

function mapProviders(
  resources: FhirResource[],
  encounter?: FhirResource
): CanonicalProvider[] {
  const participants = Array.isArray(encounter?.participant)
    ? encounter.participant
    : [];
  const providers: CanonicalProvider[] = [];

  for (const participant of participants) {
    if (!isObject(participant)) continue;
    const individual = isObject(participant.individual)
      ? participant.individual
      : undefined;
    const ref =
      individual && typeof individual.reference === "string"
        ? individual.reference
        : undefined;
    const practitioner = resolveReference(resources, ref);
    if (!practitioner) continue;

    const type0 = Array.isArray(participant.type)
      ? participant.type.find(isObject)
      : undefined;
    const coding0 =
      type0 && Array.isArray(type0.coding)
        ? type0.coding.find(isObject)
        : undefined;

    providers.push({
      id: practitioner.id,
      npi: npiFrom(practitioner),
      name: readName(practitioner),
      role:
        coding0 && typeof coding0.display === "string"
          ? coding0.display
          : coding0 && typeof coding0.code === "string"
            ? coding0.code
            : undefined,
    });
  }

  if (providers.length === 0) {
    for (const practitioner of findResources(resources, "Practitioner")) {
      providers.push({
        id: practitioner.id,
        npi: npiFrom(practitioner),
        name: readName(practitioner),
      });
    }
  }

  return providers;
}

function mapDiagnoses(
  resources: FhirResource[],
  encounter?: FhirResource
): CanonicalDiagnosis[] {
  const diagnoses: CanonicalDiagnosis[] = [];
  const diagnosisList = Array.isArray(encounter?.diagnosis)
    ? encounter.diagnosis
    : [];

  for (const item of diagnosisList) {
    if (!isObject(item)) continue;
    const conditionRef = isObject(item.condition)
      ? item.condition
      : undefined;
    const ref =
      conditionRef && typeof conditionRef.reference === "string"
        ? conditionRef.reference
        : undefined;
    const condition = resolveReference(resources, ref);
    if (!condition) continue;

    const coding = isObject(condition.code)
      ? Array.isArray(condition.code.coding)
        ? condition.code.coding.find(isObject)
        : undefined
      : undefined;

    diagnoses.push({
      code:
        coding && typeof coding.code === "string"
          ? coding.code
          : "UNKNOWN",
      system:
        coding && typeof coding.system === "string" ? coding.system : undefined,
      display:
        coding && typeof coding.display === "string"
          ? coding.display
          : typeof condition.code === "object" &&
              condition.code &&
              "text" in condition.code &&
              typeof (condition.code as { text?: unknown }).text === "string"
            ? (condition.code as { text: string }).text
            : undefined,
      rank: typeof item.rank === "number" ? item.rank : undefined,
    });
  }

  return diagnoses;
}

export class AdmissionNormalizationService implements NormalizationService {
  async toAdmissionEvent(
    bundle: unknown,
    meta: { eventId: UUID; correlationId: CorrelationId; sourceSystem: string }
  ): Promise<AdmissionEvent> {
    const fhirBundle = asBundle(bundle);
    if (!fhirBundle) {
      throw new Error("Cannot normalize non-Bundle payload");
    }

    const resources = extractResources(fhirBundle);
    const patient = findResource(resources, "Patient");
    const encounter = findResource(resources, "Encounter");
    const coverage = findResource(resources, "Coverage");
    const messageHeader = findResource(resources, "MessageHeader");

    const classCode = getNestedString(encounter as Record<string, unknown> | undefined, [
      "class",
      "code",
    ]);
    const periodStart = getNestedString(
      encounter as Record<string, unknown> | undefined,
      ["period", "start"]
    );
    const periodEnd = getNestedString(
      encounter as Record<string, unknown> | undefined,
      ["period", "end"]
    );

    const eventTimestamp =
      fhirBundle.timestamp ??
      periodStart ??
      new Date().toISOString();

    const sourceName = getNestedString(
      messageHeader as Record<string, unknown> | undefined,
      ["source", "name"]
    );

    return {
      eventId: meta.eventId,
      correlationId: meta.correlationId,
      sourceSystem: meta.sourceSystem || sourceName || "UNKNOWN",
      eventType: "ADMISSION",
      eventTimestamp,
      patient: mapPatient(patient),
      encounter: {
        id: encounter?.id,
        status:
          typeof encounter?.status === "string" ? encounter.status : undefined,
        class: mapEncounterClass(classCode) ?? "UNKNOWN",
        period: {
          start: periodStart,
          end: periodEnd,
        },
      },
      admission: {
        admissionDateTime: periodStart,
      },
      facility: mapFacility(resources, encounter),
      payer: mapPayer(resources, coverage),
      coverage: mapCoverage(coverage),
      diagnoses: mapDiagnoses(resources, encounter),
      providers: mapProviders(resources, encounter),
      sourceMetadata: {
        bundleId: fhirBundle.id,
        bundleType: fhirBundle.type,
        messageHeaderId: messageHeader?.id,
        sourceEndpoint: getNestedString(
          messageHeader as Record<string, unknown> | undefined,
          ["source", "endpoint"]
        ),
      },
    };
  }
}
