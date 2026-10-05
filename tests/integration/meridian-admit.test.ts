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

  it("admits an ER-to-admit patient through NOA and stores the ED encounter", async () => {
    const patient = SEED_PATIENTS[0];
    const admittedAt = new Date().toISOString();
    const base = {
      patientId: patient.id,
      encounterClass: "INPATIENT" as const,
      admissionType: "Emergency" as const,
      facilityId: "fac-jax",
      departmentId: "dep-medsurg",
      unit: "4 South",
      room: "402",
      admittedAt,
      attendingProviderId: "prov-williams",
      principalDiagnosis: "Pneumonia",
      coverage: { ...patient.coverage },
    };
    const edVisit = {
      arrivedAt: new Date(Date.now() - 90 * 60_000).toISOString(),
      chiefComplaint: "Shortness of breath",
      providerId: "prov-chen",
      location: "ED Bay 7",
    };

    const result = await admitPatient({ ...base, edVisit });
    expect(result.fhirEvent.status).toBe("SENT");
    expect(result.notification.processingState).toBe("ACKNOWLEDGED");
    expect(result.encounter.edVisit).toEqual(edVisit);
    const types = (result.fhirEvent.bundle.entry as Array<{ resource: { resourceType: string } }>)
      .map((e) => e.resource.resourceType)
      .filter((t) => t === "Encounter");
    expect(types).toHaveLength(2);

    await expect(
      admitPatient({ ...base, edVisit: { ...edVisit, arrivedAt: new Date(Date.now() + 60_000).toISOString() } })
    ).rejects.toThrow("ED arrival must be before");
    await expect(
      admitPatient({ ...base, edVisit: { ...edVisit, providerId: "nope" } })
    ).rejects.toThrow("Invalid ED attending");
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
