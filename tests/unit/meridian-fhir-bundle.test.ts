import { describe, expect, it } from "vitest";
import { buildAdmissionBundle } from "@/src/meridian/fhir/build-admission-bundle";
import { FACILITIES, DEPARTMENTS, PROVIDERS, SEED_PATIENTS } from "@/src/meridian/data/seed";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";
import type { Encounter } from "@/src/meridian/types";

describe("Meridian FHIR admission bundle", () => {
  it("builds a Bundle that passes AdmissionFhirValidator", async () => {
    const patient = SEED_PATIENTS[0];
    const encounter: Encounter = {
      id: "enc-test-1",
      patientId: patient.id,
      encounterClass: "INPATIENT",
      admissionType: "Emergency",
      status: "Admitted",
      facilityId: "fac-jax",
      departmentId: "dep-medsurg",
      unit: "4 South",
      room: "402",
      admittedAt: "2026-09-09T18:32:00.000Z",
      attendingProviderId: "prov-williams",
      principalDiagnosis: "Pneumonia",
      service: "Internal Medicine",
      coverageSnapshot: patient.coverage,
    };
    const bundle = buildAdmissionBundle({
      patient,
      encounter,
      facility: FACILITIES[0],
      department: DEPARTMENTS[1],
      provider: PROVIDERS[0],
    });

    expect(bundle.resourceType).toBe("Bundle");
    expect(bundle.type).toBe("message");
    const entries = bundle.entry as Array<{ resource?: Record<string, unknown> }>;
    const patientRes = entries.find((e) => e.resource?.resourceType === "Patient")
      ?.resource as { identifier?: Array<{ type?: { coding?: Array<{ code?: string }> }; value?: string }> };
    const encounterRes = entries.find(
      (e) => e.resource?.resourceType === "Encounter"
    )?.resource as {
      identifier?: Array<{ type?: { coding?: Array<{ code?: string }> }; value?: string }>;
    };
    expect(
      patientRes.identifier?.some((i) =>
        i.type?.coding?.some((c) => c.code === "MB")
      )
    ).toBe(true);
    expect(
      encounterRes.identifier?.some((i) =>
        i.type?.coding?.some((c) => c.code === "VN")
      )
    ).toBe(true);
    const result = await new AdmissionFhirValidator().validate(bundle);
    expect(result.ok).toBe(true);
  });
});
