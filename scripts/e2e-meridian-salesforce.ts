// Manual live check: admits a synthetic Meridian patient and submits the FHIR
// admission to Salesforce through the deployed Edge Function. Creates a real
// Admission__c record in the hlsDev org.
//   npx vite-node scripts/e2e-meridian-salesforce.ts
import { readFileSync } from "node:fs";
import {
  createMemoryIngestRuntime,
  setIngestRuntime,
} from "@/src/infrastructure/composition/ingest";
import { SEED_PATIENTS } from "@/src/meridian/data/seed";
import {
  admitPatient,
  serializeAdmissionPayload,
  submitAdmissionToSalesforce,
} from "@/src/meridian/store/runtime";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}

async function main() {
  setIngestRuntime(createMemoryIngestRuntime());
  const patient = SEED_PATIENTS[0];
  const { encounter, fhirEvent } = await admitPatient({
    patientId: patient.id,
    encounterClass: "INPATIENT",
    admissionType: "Emergency",
    facilityId: "fac-jax",
    departmentId: "dep-medsurg",
    unit: "4 South",
    room: "402",
    admittedAt: new Date().toISOString(),
    attendingProviderId: "prov-williams",
    principalDiagnosis: "Pneumonia",
    service: "Internal Medicine",
    coverage: { ...patient.coverage },
  });
  const payload = serializeAdmissionPayload(fhirEvent.bundle);
  console.log(`admissionId=${encounter.id} payloadChars=${payload.length}`);

  const result = await submitAdmissionToSalesforce(encounter.id);
  const { record } = result;
  console.log(
    JSON.stringify(
      {
        outcome: result.outcome,
        status: record.status,
        salesforceRecordId: record.salesforceRecordId,
        salesforceRecordUrl: record.salesforceRecordUrl,
        submittedAt: record.submittedAt,
        attemptCount: record.attemptCount,
        errorType: record.errorType,
        errorMessage: record.errorMessage,
      },
      null,
      2
    )
  );
  if (record.status !== "SUBMITTED") process.exitCode = 1;
}

void main();
