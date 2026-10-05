import { describe, expect, it } from "vitest";
import { buildAdmissionBundle } from "@/src/meridian/fhir/build-admission-bundle";
import { FACILITIES, DEPARTMENTS, PROVIDERS, SEED_PATIENTS } from "@/src/meridian/data/seed";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";
import { AdmissionNormalizationService } from "@/src/services/normalization/normalize-admission";
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

  describe("ER-to-admit", () => {
    const patient = SEED_PATIENTS[0];
    const encounter: Encounter = {
      id: "823bf9c6-5ef4-4f23-a1c0-e3a0a7b831ce",
      patientId: patient.id,
      encounterClass: "INPATIENT",
      admissionType: "Emergency",
      status: "Admitted",
      facilityId: "fac-jax",
      departmentId: "dep-medsurg",
      unit: "4 South",
      room: "402",
      admittedAt: "2026-10-02T18:11:27.453Z",
      attendingProviderId: "prov-williams",
      principalDiagnosis: "Pneumonia",
      coverageSnapshot: patient.coverage,
      edVisit: {
        arrivedAt: "2026-10-02T16:40:00.000Z",
        chiefComplaint: "Shortness of breath",
        providerId: "prov-chen",
        location: "ED Bay 7",
      },
    };
    const build = (enc: Encounter) =>
      buildAdmissionBundle({
        patient,
        encounter: enc,
        facility: FACILITIES[0],
        department: DEPARTMENTS[1],
        provider: PROVIDERS[0],
        edProvider: PROVIDERS.find((p) => p.id === enc.edVisit?.providerId),
      });
    type Res = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
    const resources = (b: Record<string, unknown>) =>
      (b.entry as Array<{ resource: Res }>).map((e) => e.resource);

    it("adds a finished ED Encounter and links the inpatient stay to it", () => {
      const all = resources(build(encounter));
      const ed = all.find((r) => r.id === `ed-${encounter.id}`)!;
      const ip = all.find((r) => r.id === encounter.id)!;

      expect(ed).toMatchObject({
        resourceType: "Encounter",
        status: "finished",
        class: { code: "EMER" },
        priority: { coding: [{ code: "EM" }] },
        reasonCode: [{ text: "Shortness of breath" }],
        period: { start: "2026-10-02T16:40:00.000Z", end: encounter.admittedAt },
        location: [{ location: { display: "ED Bay 7" } }],
        participant: [{ individual: { reference: "Practitioner/prov-chen" } }],
      });
      expect(ip.hospitalization.admitSource.coding[0].code).toBe("emd");
      expect(ip.hospitalization.origin.reference).toBe(`Encounter/${ed.id}`);
      expect(ip.partOf.reference).toBe(`Encounter/${ed.id}`);
      expect(ip.class.code).toBe("IMP");
      expect(all.filter((r) => r.resourceType === "Practitioner").map((r) => r.id)).toEqual([
        "prov-williams",
        "prov-chen",
      ]);
    });

    it("leaves the bundle unchanged when there is no ED visit", () => {
      const all = resources(build({ ...encounter, edVisit: undefined }));
      expect(all.filter((r) => r.resourceType === "Encounter")).toHaveLength(1);
      expect(all.find((r) => r.id === encounter.id)!.hospitalization).toBeUndefined();
    });

    it("NOA validates and normalizes the inpatient encounter, with admit source", async () => {
      const bundle = build(encounter);
      expect((await new AdmissionFhirValidator().validate(bundle)).ok).toBe(true);
      const event = await new AdmissionNormalizationService().toAdmissionEvent(bundle, {
        eventId: "evt-1",
        correlationId: "NOA-TEST",
        sourceSystem: "MERIDIAN_CLINICAL",
      });
      expect(event.encounter.class).toBe("INPATIENT");
      expect(event.encounter.id).toBe(encounter.id);
      expect(event.encounter.period?.end).toBeUndefined();
      expect(event.admission.admissionDateTime).toBe(encounter.admittedAt);
      expect(event.admission.admitSource).toBe("emd");
    });
  });
});
