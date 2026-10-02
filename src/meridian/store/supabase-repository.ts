import type { SupabaseClient } from "@supabase/supabase-js";
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
import type {
  DurableSalesforceSubmission,
  MeridianRepository,
} from "@/src/meridian/store/repository";

const MIGRATION_HINT =
  "Meridian tables are missing in Supabase — apply supabase/migrations/20261002000007_meridian_persistence.sql";

function fail(context: string, error: { message: string; code?: string }): never {
  if (error.code === "42P01" || error.code === "PGRST205" || /does not exist|schema cache/i.test(error.message)) {
    throw new Error(`${MIGRATION_HINT} (${context})`);
  }
  throw new Error(`Meridian ${context}: ${error.message}`);
}

type DataRow<T> = { data: T };

export function createSupabaseMeridianRepository(
  client: SupabaseClient
): MeridianRepository {
  let seeded: Promise<void> | null = null;

  /** Inserts seed patients/encounters once; existing rows (including edits) are left untouched. */
  function ensureSeeded(): Promise<void> {
    seeded ??= (async () => {
      const now = new Date().toISOString();
      const { error: pErr } = await client.from("meridian_patients").upsert(
        SEED_PATIENTS.map((p) => ({ id: p.id, mrn: p.mrn, data: p })),
        { onConflict: "id", ignoreDuplicates: true }
      );
      if (pErr) fail("seed patients", pErr);
      const { error: eErr } = await client.from("meridian_encounters").upsert(
        createSeedEncounters(now).map((e) => ({
          id: e.id,
          patient_id: e.patientId,
          status: e.status,
          admitted_at: e.admittedAt,
          data: e,
        })),
        { onConflict: "id", ignoreDuplicates: true }
      );
      if (eErr) fail("seed encounters", eErr);
    })().catch((e) => {
      seeded = null;
      throw e;
    });
    return seeded;
  }

  async function selectData<T>(
    table: string,
    context: string,
    build: (q: ReturnType<ReturnType<SupabaseClient["from"]>["select"]>) => PromiseLike<{
      data: unknown;
      error: { message: string; code?: string } | null;
    }>
  ): Promise<T[]> {
    await ensureSeeded();
    const { data, error } = await build(client.from(table).select("data"));
    if (error) fail(context, error);
    return ((data as DataRow<T>[] | null) ?? []).map((r) => r.data);
  }

  async function upsert(table: string, context: string, row: Record<string, unknown>) {
    await ensureSeeded();
    const { error } = await client.from(table).upsert(row, { onConflict: Object.keys(row)[0] });
    if (error) fail(context, error);
  }

  const first = <T>(rows: T[]) => rows[0] ?? null;

  return {
    kind: "supabase",

    async listPatients() {
      return selectData<Patient>("meridian_patients", "list patients", (q) =>
        q.order("mrn")
      );
    },
    async getPatient(id) {
      return first(
        await selectData<Patient>("meridian_patients", "get patient", (q) =>
          q.eq("id", id).limit(1)
        )
      );
    },
    async savePatient(patient) {
      await upsert("meridian_patients", "save patient", {
        id: patient.id,
        mrn: patient.mrn,
        data: patient,
        updated_at: new Date().toISOString(),
      });
    },

    async listEncounters() {
      return selectData<Encounter>("meridian_encounters", "list encounters", (q) =>
        q.order("admitted_at", { ascending: false })
      );
    },
    async listEncountersForPatient(patientId) {
      return selectData<Encounter>("meridian_encounters", "list encounters", (q) =>
        q.eq("patient_id", patientId).order("admitted_at", { ascending: false })
      );
    },
    async getEncounter(id) {
      return first(
        await selectData<Encounter>("meridian_encounters", "get encounter", (q) =>
          q.eq("id", id).limit(1)
        )
      );
    },
    async saveEncounter(encounter) {
      await upsert("meridian_encounters", "save encounter", {
        id: encounter.id,
        patient_id: encounter.patientId,
        status: encounter.status,
        admitted_at: encounter.admittedAt,
        data: encounter,
        updated_at: new Date().toISOString(),
      });
    },

    async getFhirEvent(id) {
      return first(
        await selectData<FhirEventRecord>("meridian_fhir_events", "get FHIR event", (q) =>
          q.eq("id", id).limit(1)
        )
      );
    },
    async findFhirByEncounter(encounterId) {
      return first(
        await selectData<FhirEventRecord>("meridian_fhir_events", "find FHIR event", (q) =>
          q.eq("encounter_id", encounterId).order("created_at").limit(1)
        )
      );
    },
    async listFhirEventsForPatient(patientId) {
      return selectData<FhirEventRecord>("meridian_fhir_events", "list FHIR events", (q) =>
        q.eq("patient_id", patientId).order("created_at", { ascending: false })
      );
    },
    async saveFhirEvent(event) {
      await upsert("meridian_fhir_events", "save FHIR event", {
        id: event.id,
        patient_id: event.patientId,
        encounter_id: event.encounterId,
        created_at: event.createdAt,
        data: event,
      });
    },

    async getNotification(id) {
      return first(
        await selectData<NotificationTrack>("meridian_notifications", "get notification", (q) =>
          q.eq("id", id).limit(1)
        )
      );
    },
    async findNotificationByEncounter(encounterId) {
      return first(
        await selectData<NotificationTrack>("meridian_notifications", "find notification", (q) =>
          q.eq("encounter_id", encounterId).order("created_at").limit(1)
        )
      );
    },
    async listNotificationsForPatient(patientId) {
      return selectData<NotificationTrack>("meridian_notifications", "list notifications", (q) =>
        q.eq("patient_id", patientId).order("created_at", { ascending: false })
      );
    },
    async saveNotification(notification) {
      await upsert("meridian_notifications", "save notification", {
        id: notification.id,
        patient_id: notification.patientId,
        encounter_id: notification.encounterId,
        created_at: notification.createdAt,
        data: notification,
      });
    },

    async getSalesforceSubmission(admissionId) {
      return first(
        await selectData<SalesforceSubmissionRecord>(
          "meridian_salesforce_submissions",
          "get Salesforce submission",
          (q) => q.eq("admission_id", admissionId).limit(1)
        )
      );
    },
    async saveSalesforceSubmission(record) {
      await upsert("meridian_salesforce_submissions", "save Salesforce submission", {
        admission_id: record.admissionId,
        data: record,
        updated_at: new Date().toISOString(),
      });
    },
    async getDurableSalesforceSubmission(admissionId) {
      const { data, error } = await client
        .from("meridian_integration_submissions")
        .select(
          "status, salesforce_record_id, salesforce_record_url, submitted_at, last_attempt_at, error_type, error_message, attempt_count, updated_at"
        )
        .eq("admission_id", admissionId)
        .eq("integration_type", "SALESFORCE_ADMISSION")
        .maybeSingle();
      if (error || !data) return null;
      const row = data as Record<string, unknown>;
      const str = (k: string) => (typeof row[k] === "string" ? (row[k] as string) : undefined);
      const durable: DurableSalesforceSubmission = {
        status: row.status as SalesforceIntegrationStatus,
        salesforceRecordId: str("salesforce_record_id"),
        salesforceRecordUrl: str("salesforce_record_url"),
        submittedAt: str("submitted_at"),
        lastAttemptAt: str("last_attempt_at"),
        errorType: str("error_type"),
        errorMessage: str("error_message"),
        attemptCount: Number(row.attempt_count ?? 0),
        updatedAt: str("updated_at"),
      };
      return durable;
    },
  };
}
