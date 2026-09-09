import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";

function loadFixture(name: string): unknown {
  const file = path.join(process.cwd(), "fhir", "fixtures", name);
  return JSON.parse(readFileSync(file, "utf8"));
}

describe("AdmissionFhirValidator", () => {
  const validator = new AdmissionFhirValidator();

  it("accepts the Medicare inpatient golden-path fixture", async () => {
    const result = await validator.validate(
      loadFixture("admission-medicare-inpatient.json")
    );
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects bundles missing Patient", async () => {
    const result = await validator.validate(
      loadFixture("admission-invalid-missing-patient.json")
    );
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "MISSING_PATIENT")).toBe(true);
  });

  it("rejects bundles missing admission datetime", async () => {
    const result = await validator.validate(
      loadFixture("admission-missing-admission-datetime.json")
    );
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((e) => e.code === "MISSING_ADMISSION_DATETIME")
    ).toBe(true);
  });

  it("rejects non-Bundle payloads", async () => {
    const result = await validator.validate({ resourceType: "Patient" });
    expect(result.ok).toBe(false);
    expect(result.errors[0]?.code).toBe("NOT_A_BUNDLE");
  });
});
