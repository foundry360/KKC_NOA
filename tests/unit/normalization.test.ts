import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AdmissionNormalizationService } from "@/src/services/normalization/normalize-admission";

function loadFixture(name: string): unknown {
  const file = path.join(process.cwd(), "fhir", "fixtures", name);
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("AdmissionNormalizationService", () => {
  const normalizer = new AdmissionNormalizationService();

  it("maps FHIR Bundle to canonical AdmissionEvent", async () => {
    const admission = await normalizer.toAdmissionEvent(
      loadFixture("admission-medicare-inpatient.json"),
      {
        eventId: "00000000-0000-4000-8000-000000000099",
        correlationId: "NOA-20260909-000099",
        sourceSystem: "SYNTHETIC_EHR",
      }
    );

    expect(admission.eventType).toBe("ADMISSION");
    expect(admission.patient.name.family).toBe("SYNTHETIC");
    expect(admission.patient.name.given).toEqual(["ADA", "LOVELACE"]);
    expect(admission.encounter.class).toBe("INPATIENT");
    expect(admission.admission.admissionDateTime).toBe("2026-09-09T14:30:00Z");
    expect(admission.payer.payerType).toBe("MEDICARE");
    expect(admission.facility.name).toBe("Synthetic General Hospital");
    expect(admission.coverage.subscriberId).toBe("SYN-MBI-000111");
    expect(admission.patient.memberId).toBe("SYN-MBI-000111");
    expect(admission.patient.mrn).toBe("SYN-MRN-10001");
    expect(admission.encounter.visitId).toBe("VISIT-001");
    expect(admission.encounter.locationDisplay).toBe("4 South / Room 402");
    expect(admission.diagnoses[0]?.code).toBe("J18.9");
    expect(admission.providers[0]?.name?.family).toBe("SYNTHETIC");
    expect(admission.providers[0]?.npi).toBe("1999999999");
    expect(admission.sourceMetadata.bundleId).toBe(
      "synthetic-admission-medicare-inpatient-001"
    );
  });
});
