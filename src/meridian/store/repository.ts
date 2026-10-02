import {
  createSeedEncounters,
  SEED_PATIENTS,
} from "@/src/meridian/data/seed";
import type {
  Encounter,
  FhirEventRecord,
  NotificationTrack,
  Patient,
  SalesforceIntegrationStatus,
  SalesforceSubmissionRecord,
} from "@/src/meridian/types";

/** Authoritative status written by the Edge Function (meridian_integration_submissions). */
export type DurableSalesforceSubmission = {
  status: SalesforceIntegrationStatus;
  salesforceRecordId?: string;
  salesforceRecordUrl?: string;
  submittedAt?: string;
  lastAttemptAt?: string;
  errorType?: string;
  errorMessage?: string;
  attemptCount: number;
  updatedAt?: string;
};

export interface MeridianRepository {
  readonly kind: "memory" | "supabase";

  listPatients(): Promise<Patient[]>;
  getPatient(id: string): Promise<Patient | null>;
  savePatient(patient: Patient): Promise<void>;

  listEncounters(): Promise<Encounter[]>;
  listEncountersForPatient(patientId: string): Promise<Encounter[]>;
  getEncounter(id: string): Promise<Encounter | null>;
  saveEncounter(encounter: Encounter): Promise<void>;

  getFhirEvent(id: string): Promise<FhirEventRecord | null>;
  findFhirByEncounter(encounterId: string): Promise<FhirEventRecord | null>;
  listFhirEventsForPatient(patientId: string): Promise<FhirEventRecord[]>;
  saveFhirEvent(event: FhirEventRecord): Promise<void>;

  getNotification(id: string): Promise<NotificationTrack | null>;
  findNotificationByEncounter(encounterId: string): Promise<NotificationTrack | null>;
  listNotificationsForPatient(patientId: string): Promise<NotificationTrack[]>;
  saveNotification(notification: NotificationTrack): Promise<void>;

  getSalesforceSubmission(admissionId: string): Promise<SalesforceSubmissionRecord | null>;
  saveSalesforceSubmission(record: SalesforceSubmissionRecord): Promise<void>;
  getDurableSalesforceSubmission(
    admissionId: string
  ): Promise<DurableSalesforceSubmission | null>;
}

export const byAdmittedDesc = (a: Encounter, b: Encounter) =>
  b.admittedAt.localeCompare(a.admittedAt);
const byCreatedDesc = (a: { createdAt: string }, b: { createdAt: string }) =>
  b.createdAt.localeCompare(a.createdAt);

/** Process-local store for tests and offline use (no Supabase configured). */
export function createMemoryMeridianRepository(): MeridianRepository {
  const patients = new Map(SEED_PATIENTS.map((p) => [p.id, structuredClone(p)]));
  const encounters = new Map(
    createSeedEncounters(new Date().toISOString()).map((e) => [e.id, e])
  );
  const fhirEvents = new Map<string, FhirEventRecord>();
  const notifications = new Map<string, NotificationTrack>();
  const submissions = new Map<string, SalesforceSubmissionRecord>();
  const clone = <T>(v: T): T => structuredClone(v);

  return {
    kind: "memory",
    async listPatients() {
      return [...patients.values()].map(clone);
    },
    async getPatient(id) {
      const p = patients.get(id);
      return p ? clone(p) : null;
    },
    async savePatient(patient) {
      patients.set(patient.id, clone(patient));
    },
    async listEncounters() {
      return [...encounters.values()].map(clone).sort(byAdmittedDesc);
    },
    async listEncountersForPatient(patientId) {
      return [...encounters.values()]
        .filter((e) => e.patientId === patientId)
        .map(clone)
        .sort(byAdmittedDesc);
    },
    async getEncounter(id) {
      const e = encounters.get(id);
      return e ? clone(e) : null;
    },
    async saveEncounter(encounter) {
      encounters.set(encounter.id, clone(encounter));
    },
    async getFhirEvent(id) {
      const e = fhirEvents.get(id);
      return e ? clone(e) : null;
    },
    async findFhirByEncounter(encounterId) {
      const e = [...fhirEvents.values()].find((x) => x.encounterId === encounterId);
      return e ? clone(e) : null;
    },
    async listFhirEventsForPatient(patientId) {
      return [...fhirEvents.values()]
        .filter((e) => e.patientId === patientId)
        .map(clone)
        .sort(byCreatedDesc);
    },
    async saveFhirEvent(event) {
      fhirEvents.set(event.id, clone(event));
    },
    async getNotification(id) {
      const n = notifications.get(id);
      return n ? clone(n) : null;
    },
    async findNotificationByEncounter(encounterId) {
      const n = [...notifications.values()].find((x) => x.encounterId === encounterId);
      return n ? clone(n) : null;
    },
    async listNotificationsForPatient(patientId) {
      return [...notifications.values()]
        .filter((n) => n.patientId === patientId)
        .map(clone)
        .sort(byCreatedDesc);
    },
    async saveNotification(notification) {
      notifications.set(notification.id, clone(notification));
    },
    async getSalesforceSubmission(admissionId) {
      const s = submissions.get(admissionId);
      return s ? clone(s) : null;
    },
    async saveSalesforceSubmission(record) {
      submissions.set(record.admissionId, clone(record));
    },
    async getDurableSalesforceSubmission() {
      return null;
    },
  };
}
