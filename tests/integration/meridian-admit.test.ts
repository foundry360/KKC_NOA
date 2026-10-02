import { beforeEach, describe, expect, it } from "vitest";
import { setIngestRuntime } from "@/src/infrastructure/composition/ingest";
import { createMemoryIngestRuntime } from "@/src/infrastructure/composition/ingest";
import { admitPatient, setMeridianRepository } from "@/src/meridian/store/runtime";
import { createMemoryMeridianRepository } from "@/src/meridian/store/repository";
import { SEED_PATIENTS } from "@/src/meridian/data/seed";

describe("Meridian admit → NOA", () => {
  beforeEach(() => {
    setIngestRuntime(createMemoryIngestRuntime());
    setMeridianRepository(createMemoryMeridianRepository());
  });

  it("admits John Smith and reaches ACKNOWLEDGED via in-process NOA", async () => {
    const patient = SEED_PATIENTS[0];
    const result = await admitPatient({
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
      coverage: {
        ...patient.coverage,
        payerType: "MEDICARE",
        payerName: "Medicare",
      },
    });

    expect(result.fhirEvent.status).toBe("SENT");
    expect(result.notification.demoMode).toBe(false);
    expect(result.notification.processingState).toBe("ACKNOWLEDGED");
    expect(result.notification.acknowledgement?.ackId).toBeTruthy();
  });

  it("admits commercial patient Maria Garcia through full NOA path", async () => {
    const patient = SEED_PATIENTS.find((p) => p.mrn === "MRN-10035");
    expect(patient).toBeTruthy();
    expect(patient!.coverage.payerType).toBe("COMMERCIAL");

    const result = await admitPatient({
      patientId: patient!.id,
      encounterClass: "INPATIENT",
      admissionType: "Urgent",
      facilityId: "fac-jax",
      departmentId: "dep-medsurg",
      unit: "L&D",
      room: "210",
      admittedAt: new Date().toISOString(),
      attendingProviderId: "prov-lee",
      principalDiagnosis: "Labor",
      service: "Obstetrics",
      coverage: structuredClone(patient!.coverage),
    });

    expect(result.fhirEvent.status).toBe("SENT");
    expect(result.notification.demoMode).toBe(false);
    expect(result.notification.processingState).toBe("ACKNOWLEDGED");
    expect(result.notification.decision).toBe("SEND_NOA");
    expect(result.notification.adapterKey).toBe("mock");
  });
});
