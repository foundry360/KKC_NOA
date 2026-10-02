import { randomUUID } from "node:crypto";
import {
  createSeedEncounters,
  DEPARTMENTS,
  FACILITIES,
  PAYERS,
  PROVIDERS,
  SEED_PATIENTS,
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

export type MeridianStore = {
  patients: Map<string, Patient>;
  encounters: Map<string, Encounter>;
  fhirEvents: Map<string, FhirEventRecord>;
  notifications: Map<string, NotificationTrack>;
  /** patientId → active encounter id */
  activeEncounterByPatient: Map<string, string>;
  /** admission (encounter) id → Salesforce integration status */
  salesforceSubmissions: Map<string, SalesforceSubmissionRecord>;
  /** admission ids with a Salesforce call currently in flight in this process */
  salesforceInFlight: Set<string>;
};

const STORE_VERSION = 3;

const globalStore = globalThis as typeof globalThis & {
  __meridianStore?: MeridianStore;
  __meridianStoreVersion?: number;
};

function createStore(): MeridianStore {
  const patients = new Map(SEED_PATIENTS.map((p) => [p.id, structuredClone(p)]));
  const encounters = new Map<string, Encounter>();
  const activeEncounterByPatient = new Map<string, string>();
  const now = new Date().toISOString();
  for (const enc of createSeedEncounters(now)) {
    encounters.set(enc.id, enc);
    activeEncounterByPatient.set(enc.patientId, enc.id);
  }
  return {
    patients,
    encounters,
    fhirEvents: new Map(),
    notifications: new Map(),
    activeEncounterByPatient,
    salesforceSubmissions: new Map(),
    salesforceInFlight: new Set(),
  };
}

export function getMeridianStore(): MeridianStore {
  if (
    !globalStore.__meridianStore ||
    globalStore.__meridianStoreVersion !== STORE_VERSION
  ) {
    globalStore.__meridianStore = createStore();
    globalStore.__meridianStoreVersion = STORE_VERSION;
  }
  return globalStore.__meridianStore;
}

export function listCensus() {
  const store = getMeridianStore();
  const rows = [...store.patients.values()].map((patient) => {
    const encId = store.activeEncounterByPatient.get(patient.id);
    const encounter = encId ? store.encounters.get(encId) : undefined;
    const facility = encounter
      ? FACILITIES.find((f) => f.id === encounter.facilityId)
      : undefined;
    return { patient, encounter, facility };
  });
  return rows;
}

export function getPatient(id: string) {
  return getMeridianStore().patients.get(id) ?? null;
}

export function getActiveEncounter(patientId: string) {
  const store = getMeridianStore();
  const encId = store.activeEncounterByPatient.get(patientId);
  return encId ? store.encounters.get(encId) ?? null : null;
}

export function getEncounter(id: string) {
  return getMeridianStore().encounters.get(id) ?? null;
}

export function getFhirEvent(id: string) {
  return getMeridianStore().fhirEvents.get(id) ?? null;
}

export function getNotification(id: string) {
  return getMeridianStore().notifications.get(id) ?? null;
}

export function findNotificationByEncounter(encounterId: string) {
  const store = getMeridianStore();
  return (
    [...store.notifications.values()].find((n) => n.encounterId === encounterId) ??
    null
  );
}

export function findFhirByEncounter(encounterId: string) {
  const store = getMeridianStore();
  return (
    [...store.fhirEvents.values()].find((e) => e.encounterId === encounterId) ??
    null
  );
}

export function listFhirEventsForPatient(patientId: string) {
  return [...getMeridianStore().fhirEvents.values()]
    .filter((e) => e.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listNotificationsForPatient(patientId: string) {
  return [...getMeridianStore().notifications.values()]
    .filter((n) => n.patientId === patientId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function searchPatients(query: string): Patient[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...getMeridianStore().patients.values()];
  return [...getMeridianStore().patients.values()].filter(
    (p) =>
      p.mrn.toLowerCase().includes(q) ||
      p.family.toLowerCase().includes(q) ||
      p.given.join(" ").toLowerCase().includes(q) ||
      `${p.given.join(" ")} ${p.family}`.toLowerCase().includes(q)
  );
}

function nextMrn(store: MeridianStore): string {
  let max = 10020;
  for (const p of store.patients.values()) {
    const m = /^MRN-(\d+)$/i.exec(p.mrn);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `MRN-${max + 1}`;
}

export function createPatient(input: CreatePatientInput): Patient {
  const store = getMeridianStore();
  const family = input.family.trim();
  const given = input.given.map((g) => g.trim()).filter(Boolean);
  if (!family || given.length === 0) {
    throw new Error("Patient name is required");
  }
  if (!input.birthDate) throw new Error("Date of birth is required");
  if (!input.coverage.memberId.trim()) {
    throw new Error("Member ID is required");
  }

  const mrn = (input.mrn?.trim() || nextMrn(store)).toUpperCase();
  if ([...store.patients.values()].some((p) => p.mrn === mrn)) {
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

  store.patients.set(patient.id, patient);
  return structuredClone(patient);
}

export function updatePatient(input: UpdatePatientInput): Patient {
  const store = getMeridianStore();
  const existing = store.patients.get(input.id);
  if (!existing) throw new Error("Patient not found");

  if (input.mrn && input.mrn !== existing.mrn) {
    const conflict = [...store.patients.values()].some(
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

  store.patients.set(existing.id, existing);
  return structuredClone(existing);
}

export function dischargeEncounter(encounterId: string): Encounter {
  const store = getMeridianStore();
  const encounter = store.encounters.get(encounterId);
  if (!encounter) throw new Error("Encounter not found");
  encounter.status = "Discharged";
  store.encounters.set(encounter.id, encounter);
  if (store.activeEncounterByPatient.get(encounter.patientId) === encounter.id) {
    store.activeEncounterByPatient.delete(encounter.patientId);
  }
  return structuredClone(encounter);
}

export function listEncounters(): Encounter[] {
  return [...getMeridianStore().encounters.values()].sort((a, b) =>
    b.admittedAt.localeCompare(a.admittedAt)
  );
}

export function listEncountersForPatient(patientId: string): Encounter[] {
  return listEncounters().filter((e) => e.patientId === patientId);
}

export async function admitPatient(input: AdmitInput): Promise<{
  encounter: Encounter;
  fhirEvent: FhirEventRecord;
  notification: NotificationTrack;
}> {
  const store = getMeridianStore();
  const patient = store.patients.get(input.patientId);
  if (!patient) throw new Error("Patient not found");

  const facility = FACILITIES.find((f) => f.id === input.facilityId);
  const department = DEPARTMENTS.find((d) => d.id === input.departmentId);
  const provider = PROVIDERS.find((p) => p.id === input.attendingProviderId);
  if (!facility || !department || !provider) {
    throw new Error("Invalid facility, department, or provider");
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

  store.encounters.set(encounter.id, encounter);
  store.activeEncounterByPatient.set(patient.id, encounter.id);
  store.fhirEvents.set(fhirEvent.id, fhirEvent);
  store.notifications.set(notification.id, notification);
  store.salesforceSubmissions.set(encounter.id, {
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

export function getSalesforceSubmission(admissionId: string) {
  return getMeridianStore().salesforceSubmissions.get(admissionId) ?? null;
}

export function isSalesforceSubmissionInFlight(admissionId: string) {
  return getMeridianStore().salesforceInFlight.has(admissionId);
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
 * generated. Duplicate submissions are blocked locally (in-flight / already
 * SUBMITTED) and durably by the Edge Function's claim on admission_id.
 */
export async function submitAdmissionToSalesforce(
  admissionId: string
): Promise<SalesforceSubmitResult> {
  const store = getMeridianStore();
  const fhirEvent = findFhirByEncounter(admissionId);
  if (!fhirEvent) throw new Error("No FHIR admission event exists for this admission");

  let record = store.salesforceSubmissions.get(admissionId);
  if (!record) {
    record = {
      admissionId,
      patientId: fhirEvent.patientId,
      fhirEventId: fhirEvent.id,
      integrationType: "SALESFORCE_ADMISSION",
      status: "PENDING",
      attemptCount: 0,
      attempts: [],
    };
    store.salesforceSubmissions.set(admissionId, record);
  }

  if (record.status === "SUBMITTED") {
    return { outcome: "already_submitted", record: structuredClone(record) };
  }
  if (store.salesforceInFlight.has(admissionId)) {
    return { outcome: "in_progress", record: structuredClone(record) };
  }

  store.salesforceInFlight.add(admissionId);
  record.status = "SUBMITTING";
  record.lastAttemptAt = new Date().toISOString();
  try {
    const response = await submitAdmissionPayload({
      admissionId,
      payload: serializeAdmissionPayload(fhirEvent.bundle),
    });
    const status = RESPONSE_STATUS[response.status] ?? "FAILED";
    const success = response.success && status === "SUBMITTED" && !!response.salesforceRecordId;

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

    if (success) {
      return {
        outcome: response.duplicate ? "already_submitted" : "submitted",
        record: structuredClone(record),
      };
    }
    return {
      outcome: record.status === "SUBMITTING" ? "in_progress" : "failed",
      record: structuredClone(record),
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
    return { outcome: "failed", record: structuredClone(record) };
  } finally {
    store.salesforceInFlight.delete(admissionId);
  }
}

export { FACILITIES, DEPARTMENTS, PROVIDERS, PAYERS };
