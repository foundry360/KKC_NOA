import { randomUUID } from "node:crypto";
import {
  DEPARTMENTS,
  FACILITIES,
  PAYERS,
  PROVIDERS,
} from "@/src/meridian/data/seed";
import type {
  AdmitInput,
  CreatePatientInput,
  Encounter,
  FhirEventRecord,
  NotificationTrack,
  Patient,
  SalesforceIntegrationStatus,
  SalesforceSubmissionRecord,
  UpdatePatientInput,
} from "@/src/meridian/types";
import { buildAdmissionBundle } from "@/src/meridian/fhir/build-admission-bundle";
import { sendFhirAdmissionEvent } from "@/src/meridian/services/noa-client";
import { submitAdmissionPayload } from "@/src/meridian/services/salesforce-client";
import { createSupabaseServiceClient } from "@/src/infrastructure/supabase/client";
import {
  byAdmittedDesc,
  createMemoryMeridianRepository,
  type MeridianRepository,
} from "@/src/meridian/store/repository";
import { createSupabaseMeridianRepository } from "@/src/meridian/store/supabase-repository";

const globalRef = globalThis as typeof globalThis & {
  __meridianRepository?: MeridianRepository;
  __meridianSalesforceInFlight?: Set<string>;
};

/**
 * Supabase-backed when the service role is configured (required on Vercel,
 * where requests may hit different instances); in-memory otherwise.
 * MERIDIAN_STORE=memory forces the in-memory store.
 */
export function getMeridianRepository(): MeridianRepository {
  if (!globalRef.__meridianRepository) {
    const client =
      process.env.MERIDIAN_STORE === "memory" ? null : createSupabaseServiceClient();
    globalRef.__meridianRepository = client
      ? createSupabaseMeridianRepository(client)
      : createMemoryMeridianRepository();
  }
  return globalRef.__meridianRepository;
}

/** Test/demo hook: replace the repository (e.g. a fresh in-memory store). */
export function setMeridianRepository(repository: MeridianRepository) {
  globalRef.__meridianRepository = repository;
  globalRef.__meridianSalesforceInFlight = new Set();
}

function salesforceInFlight(): Set<string> {
  globalRef.__meridianSalesforceInFlight ??= new Set();
  return globalRef.__meridianSalesforceInFlight;
}

const isActive = (e: Encounter) => e.status !== "Discharged";

export async function listCensus() {
  const repo = getMeridianRepository();
  const [patients, encounters] = await Promise.all([
    repo.listPatients(),
    repo.listEncounters(),
  ]);
  const activeByPatient = new Map<string, Encounter>();
  for (const enc of [...encounters].sort(byAdmittedDesc)) {
    if (isActive(enc) && !activeByPatient.has(enc.patientId)) {
      activeByPatient.set(enc.patientId, enc);
    }
  }
  return patients.map((patient) => {
    const encounter = activeByPatient.get(patient.id);
    const facility = encounter
      ? FACILITIES.find((f) => f.id === encounter.facilityId)
      : undefined;
    return { patient, encounter, facility };
  });
}

export function getPatient(id: string) {
  return getMeridianRepository().getPatient(id);
}

export async function getActiveEncounter(patientId: string) {
  const encounters = await getMeridianRepository().listEncountersForPatient(patientId);
  return encounters.find(isActive) ?? null;
}

export function getEncounter(id: string) {
  return getMeridianRepository().getEncounter(id);
}

export function getFhirEvent(id: string) {
  return getMeridianRepository().getFhirEvent(id);
}

export function getNotification(id: string) {
  return getMeridianRepository().getNotification(id);
}

export function findNotificationByEncounter(encounterId: string) {
  return getMeridianRepository().findNotificationByEncounter(encounterId);
}

export function findFhirByEncounter(encounterId: string) {
  return getMeridianRepository().findFhirByEncounter(encounterId);
}

export function listFhirEventsForPatient(patientId: string) {
  return getMeridianRepository().listFhirEventsForPatient(patientId);
}

export function listNotificationsForPatient(patientId: string) {
  return getMeridianRepository().listNotificationsForPatient(patientId);
}

export function listEncounters() {
  return getMeridianRepository().listEncounters();
}

export function listEncountersForPatient(patientId: string) {
  return getMeridianRepository().listEncountersForPatient(patientId);
}

export async function searchPatients(query: string): Promise<Patient[]> {
  const patients = await getMeridianRepository().listPatients();
  const q = query.trim().toLowerCase();
  if (!q) return patients;
  return patients.filter(
    (p) =>
      p.mrn.toLowerCase().includes(q) ||
      p.family.toLowerCase().includes(q) ||
      p.given.join(" ").toLowerCase().includes(q) ||
      `${p.given.join(" ")} ${p.family}`.toLowerCase().includes(q)
  );
}

function nextMrn(patients: Patient[]): string {
  let max = 10020;
  for (const p of patients) {
    const m = /^MRN-(\d+)$/i.exec(p.mrn);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `MRN-${max + 1}`;
}

export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const repo = getMeridianRepository();
  const family = input.family.trim();
  const given = input.given.map((g) => g.trim()).filter(Boolean);
  if (!family || given.length === 0) {
    throw new Error("Patient name is required");
  }
  if (!input.birthDate) throw new Error("Date of birth is required");
  if (!input.coverage.memberId.trim()) {
    throw new Error("Member ID is required");
  }

  const existing = await repo.listPatients();
  const mrn = (input.mrn?.trim() || nextMrn(existing)).toUpperCase();
  if (existing.some((p) => p.mrn === mrn)) {
    throw new Error(`MRN already exists: ${mrn}`);
  }

  const patient: Patient = {
    id: randomUUID(),
    mrn,
    family,
    given,
    sex: input.sex,
    birthDate: input.birthDate,
    phone: input.phone?.trim() || undefined,
    address: {
      line: input.address.line.map((l) => l.trim()).filter(Boolean),
      city: input.address.city.trim(),
      state: input.address.state.trim().toUpperCase(),
      postalCode: input.address.postalCode.trim(),
    },
    coverage: structuredClone(input.coverage),
    diagnoses: input.diagnoses?.filter(Boolean) ?? [],
    attendingProviderId: input.attendingProviderId,
  };

  if (patient.address.line.length === 0) {
    patient.address.line = ["—"];
  }

  await repo.savePatient(patient);
  return structuredClone(patient);
}

export async function updatePatient(input: UpdatePatientInput): Promise<Patient> {
  const repo = getMeridianRepository();
  const existing = await repo.getPatient(input.id);
  if (!existing) throw new Error("Patient not found");

  if (input.mrn && input.mrn !== existing.mrn) {
    const conflict = (await repo.listPatients()).some(
      (p) => p.id !== input.id && p.mrn === input.mrn
    );
    if (conflict) throw new Error(`MRN already exists: ${input.mrn}`);
    existing.mrn = input.mrn.trim().toUpperCase();
  }
  if (input.family != null) existing.family = input.family.trim();
  if (input.given != null) {
    existing.given = input.given.map((g) => g.trim()).filter(Boolean);
  }
  if (input.sex != null) existing.sex = input.sex;
  if (input.birthDate != null) existing.birthDate = input.birthDate;
  if (input.phone !== undefined) {
    existing.phone = input.phone?.trim() || undefined;
  }
  if (input.address != null) {
    existing.address = {
      line: input.address.line.map((l) => l.trim()).filter(Boolean),
      city: input.address.city.trim(),
      state: input.address.state.trim().toUpperCase(),
      postalCode: input.address.postalCode.trim(),
    };
  }
  if (input.coverage != null) {
    existing.coverage = structuredClone(input.coverage);
  }
  if (input.diagnoses != null) {
    existing.diagnoses = input.diagnoses.filter(Boolean);
  }
  if (input.attendingProviderId !== undefined) {
    existing.attendingProviderId = input.attendingProviderId || undefined;
  }

  await repo.savePatient(existing);
  return structuredClone(existing);
}

export async function dischargeEncounter(encounterId: string): Promise<Encounter> {
  const repo = getMeridianRepository();
  const encounter = await repo.getEncounter(encounterId);
  if (!encounter) throw new Error("Encounter not found");
  encounter.status = "Discharged";
  await repo.saveEncounter(encounter);
  return structuredClone(encounter);
}

export async function admitPatient(input: AdmitInput): Promise<{
  encounter: Encounter;
  fhirEvent: FhirEventRecord;
  notification: NotificationTrack;
}> {
  const repo = getMeridianRepository();
  const patient = await repo.getPatient(input.patientId);
  if (!patient) throw new Error("Patient not found");

  const facility = FACILITIES.find((f) => f.id === input.facilityId);
  const department = DEPARTMENTS.find((d) => d.id === input.departmentId);
  const provider = PROVIDERS.find((p) => p.id === input.attendingProviderId);
  if (!facility || !department || !provider) {
    throw new Error("Invalid facility, department, or provider");
  }

  let edVisit: Encounter["edVisit"];
  let edProvider: (typeof PROVIDERS)[number] | undefined;
  if (input.edVisit) {
    if (input.encounterClass === "EMERGENCY") {
      throw new Error("An ED visit can only precede an inpatient or observation admission");
    }
    edProvider = PROVIDERS.find((p) => p.id === input.edVisit!.providerId);
    if (!edProvider) throw new Error("Invalid ED attending provider");
    const arrived = Date.parse(input.edVisit.arrivedAt);
    if (Number.isNaN(arrived) || arrived >= Date.parse(input.admittedAt)) {
      throw new Error("ED arrival must be before the admission date/time");
    }
    const chiefComplaint = input.edVisit.chiefComplaint.trim();
    const location = input.edVisit.location.trim();
    if (!chiefComplaint || !location) {
      throw new Error("ED chief complaint and location are required");
    }
    edVisit = {
      arrivedAt: new Date(arrived).toISOString(),
      chiefComplaint,
      providerId: edProvider.id,
      location,
    };
  }

  const encounter: Encounter = {
    id: randomUUID(),
    patientId: patient.id,
    encounterClass: input.encounterClass,
    admissionType: input.admissionType,
    status: "Admitted",
    facilityId: input.facilityId,
    departmentId: input.departmentId,
    unit: input.unit,
    room: input.room,
    bed: input.bed,
    admittedAt: input.admittedAt,
    attendingProviderId: input.attendingProviderId,
    principalDiagnosis: input.principalDiagnosis,
    service: input.service,
    coverageSnapshot: structuredClone(input.coverage),
    edVisit,
  };

  patient.coverage = structuredClone(input.coverage);
  patient.diagnoses = [input.principalDiagnosis];
  patient.attendingProviderId = input.attendingProviderId;

  const bundle = buildAdmissionBundle({
    patient,
    encounter,
    facility,
    department,
    provider,
    edProvider,
  });

  const fhirEvent: FhirEventRecord = {
    id: randomUUID(),
    patientId: patient.id,
    encounterId: encounter.id,
    createdAt: new Date().toISOString(),
    status: "CREATED",
    fhirVersion: "R4",
    eventType: "ADMISSION",
    bundle,
  };

  const send = await sendFhirAdmissionEvent(bundle, {
    contractBusinessId: input.contractBusinessId,
    sourceSystem: "MERIDIAN_CLINICAL",
  });

  fhirEvent.correlationId = send.correlationId;
  fhirEvent.demoMode = send.demoMode;
  if (send.ok) {
    fhirEvent.status = "SENT";
  } else {
    fhirEvent.status = "FAILED";
    fhirEvent.sendError = send.error;
  }

  const notification: NotificationTrack = {
    id: randomUUID(),
    patientId: patient.id,
    encounterId: encounter.id,
    fhirEventId: fhirEvent.id,
    correlationId: send.correlationId,
    createdAt: new Date().toISOString(),
    noaEventId: send.eventId,
    processingState: send.processingState,
    acknowledgement: send.acknowledgement,
    adapterKey: send.adapterKey,
    decision: send.decision,
    demoMode: send.demoMode,
    timeline: send.timeline,
  };

  await repo.savePatient(patient);
  await repo.saveEncounter(encounter);
  await repo.saveFhirEvent(fhirEvent);
  await repo.saveNotification(notification);
  await repo.saveSalesforceSubmission({
    admissionId: encounter.id,
    patientId: patient.id,
    fhirEventId: fhirEvent.id,
    integrationType: "SALESFORCE_ADMISSION",
    status: "PENDING",
    attemptCount: 0,
    attempts: [],
  });

  return { encounter, fhirEvent, notification };
}

/** The exact Payload__c text: the stored FHIR Bundle, pretty-printed. Stable across retries. */
export function serializeAdmissionPayload(bundle: Record<string, unknown>): string {
  return JSON.stringify(bundle, null, 2);
}

const SUBMITTING_STALE_MS = 2 * 60_000;

/**
 * Meridian's submission record merged with the Edge Function's durable row,
 * which is authoritative for status, record id, and attempt count.
 */
export async function getSalesforceSubmission(
  admissionId: string
): Promise<SalesforceSubmissionRecord | null> {
  const repo = getMeridianRepository();
  const [local, durable] = await Promise.all([
    repo.getSalesforceSubmission(admissionId),
    repo.getDurableSalesforceSubmission(admissionId),
  ]);
  if (!durable) return local;
  const base: SalesforceSubmissionRecord = local ?? {
    admissionId,
    patientId: "",
    fhirEventId: "",
    integrationType: "SALESFORCE_ADMISSION",
    status: "PENDING",
    attemptCount: 0,
    attempts: [],
  };
  const localIsNewer =
    !!local?.lastAttemptAt &&
    !!durable.updatedAt &&
    Date.parse(local.lastAttemptAt) > Date.parse(durable.updatedAt) &&
    durable.status !== "SUBMITTED";
  if (localIsNewer) return base;
  return {
    ...base,
    status: durable.status,
    salesforceRecordId: durable.salesforceRecordId ?? base.salesforceRecordId,
    salesforceRecordUrl: durable.salesforceRecordUrl ?? base.salesforceRecordUrl,
    submittedAt: durable.submittedAt ?? base.submittedAt,
    lastAttemptAt: durable.lastAttemptAt ?? base.lastAttemptAt,
    errorType: durable.status === "SUBMITTED" ? undefined : durable.errorType ?? base.errorType,
    errorMessage:
      durable.status === "SUBMITTED" ? undefined : durable.errorMessage ?? base.errorMessage,
    attemptCount: Math.max(durable.attemptCount, base.attemptCount),
  };
}

export async function isSalesforceSubmissionInFlight(admissionId: string) {
  if (salesforceInFlight().has(admissionId)) return true;
  const record = await getSalesforceSubmission(admissionId);
  return (
    record?.status === "SUBMITTING" &&
    !!record.lastAttemptAt &&
    Date.now() - new Date(record.lastAttemptAt).getTime() < SUBMITTING_STALE_MS
  );
}

const RESPONSE_STATUS: Record<string, SalesforceIntegrationStatus> = {
  submitted: "SUBMITTED",
  submitting: "SUBMITTING",
  failed: "FAILED",
  retryable: "RETRYABLE",
};

export type SalesforceSubmitResult =
  | { outcome: "submitted" | "already_submitted"; record: SalesforceSubmissionRecord }
  | { outcome: "in_progress" | "failed"; record: SalesforceSubmissionRecord };

/**
 * Sends the admission's existing FHIR payload to Salesforce via the Edge
 * Function. Retries reuse the same stored Bundle; no new clinical event is
 * generated. Duplicates are blocked in-process (in-flight / already
 * SUBMITTED) and durably by the Edge Function's claim on admission_id.
 */
export async function submitAdmissionToSalesforce(
  admissionId: string
): Promise<SalesforceSubmitResult> {
  const repo = getMeridianRepository();
  const inFlight = salesforceInFlight();
  if (inFlight.has(admissionId)) {
    const current = await getSalesforceSubmission(admissionId);
    return {
      outcome: "in_progress",
      record: current ?? {
        admissionId,
        patientId: "",
        fhirEventId: "",
        integrationType: "SALESFORCE_ADMISSION",
        status: "SUBMITTING",
        attemptCount: 0,
        attempts: [],
      },
    };
  }
  inFlight.add(admissionId);
  try {
    const fhirEvent = await repo.findFhirByEncounter(admissionId);
    if (!fhirEvent) throw new Error("No FHIR admission event exists for this admission");

    const record: SalesforceSubmissionRecord = (await getSalesforceSubmission(admissionId)) ?? {
      admissionId,
      patientId: fhirEvent.patientId,
      fhirEventId: fhirEvent.id,
      integrationType: "SALESFORCE_ADMISSION",
      status: "PENDING",
      attemptCount: 0,
      attempts: [],
    };
    record.patientId ||= fhirEvent.patientId;
    record.fhirEventId ||= fhirEvent.id;

    if (record.status === "SUBMITTED") {
      return { outcome: "already_submitted", record };
    }

    record.status = "SUBMITTING";
    record.lastAttemptAt = new Date().toISOString();
    await repo.saveSalesforceSubmission(record);

    try {
      const response = await submitAdmissionPayload({
        admissionId,
        payload: serializeAdmissionPayload(fhirEvent.bundle),
      });
      const status = RESPONSE_STATUS[response.status] ?? "FAILED";
      const success =
        response.success && status === "SUBMITTED" && !!response.salesforceRecordId;

      record.status = success ? "SUBMITTED" : status === "SUBMITTED" ? "FAILED" : status;
      record.attemptCount = response.attemptCount ?? record.attemptCount + 1;
      if (success) {
        record.salesforceRecordId = response.salesforceRecordId;
        record.salesforceRecordUrl = response.salesforceRecordUrl;
        record.submittedAt = response.submittedAt ?? new Date().toISOString();
        record.errorType = undefined;
        record.errorMessage = undefined;
      } else {
        record.errorType = response.errorType ?? "UNKNOWN";
        record.errorMessage =
          response.message ?? "Salesforce submission failed. Please retry.";
      }
      record.attempts.push({
        attempt: record.attemptCount,
        at: record.lastAttemptAt,
        status: record.status,
        httpStatus: response.httpStatus,
        errorType: success ? undefined : record.errorType,
      });
      await repo.saveSalesforceSubmission(record);

      if (success) {
        return {
          outcome: response.duplicate ? "already_submitted" : "submitted",
          record,
        };
      }
      return {
        outcome: record.status === "SUBMITTING" ? "in_progress" : "failed",
        record,
      };
    } catch {
      record.status = "RETRYABLE";
      record.attemptCount += 1;
      record.errorType = "SALESFORCE_CONNECTION";
      record.errorMessage = "Salesforce submission failed. Please retry.";
      record.attempts.push({
        attempt: record.attemptCount,
        at: record.lastAttemptAt,
        status: record.status,
        errorType: record.errorType,
      });
      await repo.saveSalesforceSubmission(record).catch(() => {});
      return { outcome: "failed", record };
    }
  } finally {
    inFlight.delete(admissionId);
  }
}

export { FACILITIES, DEPARTMENTS, PROVIDERS, PAYERS };
