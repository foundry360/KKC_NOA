import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  InMemoryAuditPort,
  InMemoryDecisionRepository,
  InMemoryEventRepository,
  InMemoryRuleExecutionRepository,
  InMemoryRuleRepository,
} from "@/src/infrastructure/memory";
import { createSeedRuleVersions } from "@/src/infrastructure/seed/rules";
import { DecisioningService } from "@/src/services/decisioning/decisioning-service";
import { ConfigurableRulesEngine } from "@/src/services/decisioning/rules-engine";
import { FixedClock } from "@/src/utils/clock";
import { MemoryLogger } from "@/src/utils/logger";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import { createTestPipeline } from "../helpers/test-pipeline";

function loadFixture(name: string): unknown {
  const file = path.join(process.cwd(), "fhir", "fixtures", name);
  return JSON.parse(readFileSync(file, "utf8"));
}

function sampleAdmission(
  overrides: Partial<AdmissionEvent> = {}
): AdmissionEvent {
  return {
    eventId: "00000000-0000-4000-8000-000000000010",
    correlationId: "NOA-20260909-000010",
    sourceSystem: "SYNTHETIC_EHR",
    eventType: "ADMISSION",
    eventTimestamp: "2026-09-09T14:30:00.000Z",
    patient: { name: { family: "SYNTHETIC", given: ["ADA"] } },
    encounter: { class: "INPATIENT" },
    admission: { admissionDateTime: "2026-09-09T14:30:00.000Z" },
    facility: { name: "Synthetic General Hospital" },
    payer: { payerType: "MEDICARE", name: "Synthetic Medicare" },
    coverage: { status: "active" },
    diagnoses: [],
    providers: [],
    sourceMetadata: {},
    ...overrides,
  };
}

describe("AdmissionEvent → Decision", () => {
  const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
  let events: InMemoryEventRepository;
  let decisions: InMemoryDecisionRepository;
  let executions: InMemoryRuleExecutionRepository;
  let audit: InMemoryAuditPort;
  let decisioning: DecisioningService;

  beforeEach(() => {
    events = new InMemoryEventRepository();
    decisions = new InMemoryDecisionRepository();
    executions = new InMemoryRuleExecutionRepository();
    audit = new InMemoryAuditPort();
    const rules = new InMemoryRuleRepository();
    rules.seed(createSeedRuleVersions());

    decisioning = new DecisioningService({
      clock,
      logger: new MemoryLogger(),
      rulesEngine: new ConfigurableRulesEngine(rules),
      events,
      decisions,
      executions,
      audit,
    });
  });

  it("produces SEND_NOA for Medicare inpatient", async () => {
    await events.save({
      id: "00000000-0000-4000-8000-000000000010",
      correlationId: "NOA-20260909-000010",
      eventType: "ADMISSION",
      receivedAt: "2026-09-09T18:00:00.000Z",
      contentType: "application/fhir+json",
      processingState: "NORMALIZED",
      rawPayload: {},
    });

    const result = await decisioning.evaluate(sampleAdmission());
    expect(result.decision.decision).toBe("SEND_NOA");
    expect(result.decision.rulesApplied).toContain("FACILITY_ADMISSION_NOA");
    expect(result.processingState).toBe("EVALUATED");

    const stored = await decisions.findByEventId(result.decisionRecord.eventId);
    expect(stored?.decision).toBe("SEND_NOA");
  });

  it("produces NO_NOA_REQUIRED for outpatient", async () => {
    await events.save({
      id: "00000000-0000-4000-8000-000000000011",
      correlationId: "NOA-20260909-000011",
      eventType: "ADMISSION",
      receivedAt: "2026-09-09T18:00:00.000Z",
      contentType: "application/fhir+json",
      processingState: "NORMALIZED",
      rawPayload: {},
    });

    const result = await decisioning.evaluate(
      sampleAdmission({
        eventId: "00000000-0000-4000-8000-000000000011",
        correlationId: "NOA-20260909-000011",
        encounter: { class: "OUTPATIENT" },
      })
    );

    expect(result.decision.decision).toBe("NO_NOA_REQUIRED");
    expect(result.decision.rulesApplied).toContain("OUTPATIENT_NO_NOA");
    expect(result.processingState).toBe("EVALUATED");
  });
});

describe("Pipeline FHIR → Decision (+ Contract + Transform)", () => {
  it("golden path ends TRANSFORMED after SEND_NOA", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline, audit } = createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      correlationId: "NOA-20260909-000123",
    });

    expect(result.processingState).toBe("ACKNOWLEDGED");
    expect(result.decision?.decision).toBe("SEND_NOA");
    expect(result.decision?.ruleVersions).toContain("FACILITY_ADMISSION_NOA@1");
    expect(result.routing?.contractBusinessId).toBe("MEDICARE_NOA_MOCK_V1");
    expect(result.transformation?.payload.patient).toMatchObject({
      lastName: "SYNTHETIC",
    });
    expect(result.acknowledgement?.ackId).toBeTruthy();

    const trail = await audit.listByCorrelationId(result.correlationId);
    expect(trail.map((e) => e.action)).toEqual([
      "EVENT_RECEIVED",
      "FHIR_VALIDATED",
      "NORMALIZED",
      "RULES_EVALUATED",
      "DECISION_CREATED",
      "CONTRACT_SELECTED",
      "TRANSFORM_EXECUTED",
      "DELIVERY_STARTED",
      "DELIVERY_ATTEMPTED",
      "DELIVERY_SUCCEEDED",
      "ACKNOWLEDGEMENT_RECEIVED",
    ]);
  });

  it("outpatient fixture yields NO_NOA_REQUIRED without routing", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline, audit } = createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-outpatient-no-noa.json"),
      contentType: "application/fhir+json",
    });

    expect(result.processingState).toBe("EVALUATED");
    expect(result.decision?.decision).toBe("NO_NOA_REQUIRED");
    expect(
      (await audit.listByCorrelationId(result.correlationId)).some(
        (e) => e.action === "NOA_NOT_REQUIRED"
      )
    ).toBe(true);
  });
});
