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
  patient: {
    mrn: "SYN-MRN-10001",
    memberId: "SYN-MBI-000111",
    name: { family: "SYNTHETIC", given: ["ADA", "LOVELACE"] },
    birthDate: "1970-01-15",
    gender: "female",
    phone: "555-0100",
    address: {
      line: ["42 Example St"],
      city: "Exampleville",
      state: "MA",
      postalCode: "02108",
    },
  },
  encounter: {
    class: "INPATIENT",
    visitId: "VISIT-001",
    status: "in-progress",
    locationDisplay: "4 South / Room 402",
  },
  admission: { admissionDateTime: "2026-09-09T14:30:00Z" },
  facility: { name: "Synthetic General Hospital", npi: "1999999998" },
  payer: { payerType: "MEDICARE", name: "Synthetic Medicare" },
  coverage: {
    subscriberId: "SYN-MBI-000111",
    status: "active",
    plan: "SYNTHETIC-MEDICARE-A",
  },
  diagnoses: [],
  providers: [
    {
      npi: "1999999999",
      name: { family: "SYNTHETIC", given: ["GRACE"] },
      role: "attender",
    },
  ],
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
      patient: {
        lastName: "SYNTHETIC",
        firstName: "ADA",
        memberId: "SYN-MBI-000111",
        mrn: "SYN-MRN-10001",
      },
      encounterClass: "INPATIENT",
      payerType: "MEDICARE",
      correlationId: "NOA-20260909-000030",
      attendingProviderNpi: "1999999999",
      facilityNpi: "1999999998",
    });
    expect(
      result.mappingTrace
        .filter((t) =>
          definition.mappings.find(
            (m) => m.sourcePath === t.sourcePath && m.targetPath === t.targetPath
          )?.required
        )
        .every((t) => t.status !== "MISSING")
    ).toBe(true);
  });

  it("maps expanded NOA fields onto Pega spreadsheet property names", async () => {
    const engine = new SimpleMappingTransformationEngine();
    const definition = createSeedTransformations().find(
      (t) => t.code === "MEDICARE_NOA_PEGA_TRANSFORM"
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
      MemberID: "SYN-MBI-000111",
      VisitID: "VISIT-001",
      ProviderNPI: "1999999999",
      EncounterLocationName: "4 South / Room 402",
      FacilityNPI: "1999999998",
      DateOfBirth: "1970-01-15",
      CheckInDateTime: "2026-09-09T14:30:00Z",
    });
  });

  it("maps expanded NOA fields onto Salesforce field names", async () => {
    const engine = new SimpleMappingTransformationEngine();
    const definition = createSeedTransformations().find(
      (t) => t.code === "MEDICARE_NOA_SF_TRANSFORM"
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
      MemberId__c: "SYN-MBI-000111",
      VisitId__c: "VISIT-001",
      ProviderNPI__c: "1999999999",
      LocationName__c: "4 South / Room 402",
    });
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
