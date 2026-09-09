import { describe, expect, it } from "vitest";
import {
  SimpleMappingTransformationEngine,
  TransformFailedError,
} from "@/src/services/transformation/mapping-engine";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { TransformationDefinition } from "@/src/domain/transformations/transformation";
import { setByPath } from "@/src/utils/path-set";
import { createSeedTransformations } from "@/src/infrastructure/seed/transformations";

const admission: AdmissionEvent = {
  eventId: "00000000-0000-4000-8000-000000000030",
  correlationId: "NOA-20260909-000030",
  sourceSystem: "SYNTHETIC_EHR",
  eventType: "ADMISSION",
  eventTimestamp: "2026-09-09T14:30:00.000Z",
  patient: { name: { family: "SYNTHETIC", given: ["ADA", "LOVELACE"] } },
  encounter: { class: "INPATIENT" },
  admission: { admissionDateTime: "2026-09-09T14:30:00Z" },
  facility: { name: "Synthetic General Hospital" },
  payer: { payerType: "MEDICARE" },
  coverage: {},
  diagnoses: [],
  providers: [],
  sourceMetadata: {},
};

describe("path-set + mapping engine", () => {
  it("setByPath creates nested objects", () => {
    const target: Record<string, unknown> = {};
    setByPath(target, "patient.lastName", "SYNTHETIC");
    expect(target).toEqual({ patient: { lastName: "SYNTHETIC" } });
  });

  it("maps AdmissionEvent to mock destination payload", async () => {
    const engine = new SimpleMappingTransformationEngine();
    const definition = createSeedTransformations().find(
      (t) => t.code === "MEDICARE_NOA_MOCK_TRANSFORM"
    )!;

    const result = await engine.transform(admission, definition, {
      decision: "SEND_NOA",
      notificationRequired: true,
      notificationType: "NOA",
      priority: "HIGH",
      rulesApplied: [],
      ruleVersions: [],
    });

    expect(result.payload).toMatchObject({
      notificationType: "NOA",
      patient: { lastName: "SYNTHETIC", firstName: "ADA" },
      encounterClass: "INPATIENT",
      payerType: "MEDICARE",
      correlationId: "NOA-20260909-000030",
    });
    expect(result.mappingTrace.every((t) => t.status !== "MISSING")).toBe(true);
  });

  it("fails when required fields are missing", async () => {
    const engine = new SimpleMappingTransformationEngine();
    const definition: TransformationDefinition = {
      id: "x",
      code: "FAIL",
      version: 1,
      sourceModel: "AdmissionEvent",
      targetFormat: "JSON",
      mappings: [
        {
          sourcePath: "patient.name.family",
          targetPath: "lastName",
          required: true,
        },
        {
          sourcePath: "does.not.exist",
          targetPath: "requiredMissing",
          required: true,
        },
      ],
    };

    await expect(engine.transform(admission, definition)).rejects.toBeInstanceOf(
      TransformFailedError
    );
  });
});
