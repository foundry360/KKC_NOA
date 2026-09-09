import { describe, expect, it } from "vitest";
import {
  InMemoryContractRepository,
  InMemoryDestinationRepository,
  InMemoryTransformationRepository,
} from "@/src/infrastructure/memory/contract-repositories";
import {
  DEFAULT_NOA_CONTRACT_BUSINESS_ID,
  SEED_CONTRACTS,
  SEED_DESTINATIONS,
} from "@/src/infrastructure/seed/contracts";
import { createSeedTransformations } from "@/src/infrastructure/seed/transformations";
import { DefaultContractRegistry } from "@/src/services/routing/contract-registry";
import { FixedClock } from "@/src/utils/clock";
import { MemoryLogger } from "@/src/utils/logger";
import { createTestPipeline } from "../helpers/test-pipeline";
import { readFileSync } from "node:fs";
import path from "node:path";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision } from "@/src/domain/decisions/decision";
import {
  InMemoryAuditPort,
  InMemoryEventRepository,
} from "@/src/infrastructure/memory";
import { InMemoryRoutingSelectionRepository } from "@/src/infrastructure/memory/routing-selection-repository";
import { RoutingService } from "@/src/services/routing/routing-service";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "fhir", "fixtures", name), "utf8")
  );
}

function createRegistry() {
  const destinations = new InMemoryDestinationRepository();
  destinations.seed(SEED_DESTINATIONS);
  const contracts = new InMemoryContractRepository();
  contracts.seed(SEED_CONTRACTS);
  const transformations = new InMemoryTransformationRepository();
  transformations.seed(createSeedTransformations());
  return new DefaultContractRegistry(
    contracts,
    destinations,
    transformations,
    DEFAULT_NOA_CONTRACT_BUSINESS_ID
  );
}

describe("ContractRegistry", () => {
  const asOf = new Date("2026-09-09T14:30:00.000Z");

  it("selects default mock contract for Medicare NOA", async () => {
    const registry = createRegistry();
    const result = await registry.resolve({
      payerType: "MEDICARE",
      notificationType: "NOA",
      asOf,
    });

    expect(result?.contractVersion.contractBusinessId).toBe(
      "MEDICARE_NOA_MOCK_V1"
    );
    expect(result?.adapterKey).toBe("mock");
    expect(result?.destination.code).toBe("MOCK_PAYER");
    expect(result?.transformation.code).toBe("MEDICARE_NOA_MOCK_TRANSFORM");
  });

  it("routes same decision to Salesforce via contract override", async () => {
    const registry = createRegistry();
    const result = await registry.resolve({
      payerType: "MEDICARE",
      notificationType: "NOA",
      contractBusinessId: "MEDICARE_NOA_SF_V1",
      asOf,
    });

    expect(result?.contractVersion.contractBusinessId).toBe("MEDICARE_NOA_SF_V1");
    expect(result?.adapterKey).toBe("salesforce");
    expect(result?.destination.code).toBe("SF_NOA_INBOX");
  });

  it("routes same decision to Pega via contract override", async () => {
    const registry = createRegistry();
    const result = await registry.resolve({
      payerType: "MEDICARE",
      notificationType: "NOA",
      contractBusinessId: "MEDICARE_NOA_PEGA_V1",
      asOf,
    });

    expect(result?.adapterKey).toBe("pega");
    expect(result?.destination.code).toBe("PEGA_NOA_CASE");
  });

  it("returns null for unknown payer (NO_CONTRACT)", async () => {
    const registry = createRegistry();
    const result = await registry.resolve({
      payerType: "COMMERCIAL",
      notificationType: "NOA",
      asOf,
    });
    expect(result).toBeNull();
  });
});

describe("Decision → Contract via RoutingService", () => {
  it("persists ROUTED selection for SEND_NOA", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const events = new InMemoryEventRepository();
    const audit = new InMemoryAuditPort();
    const selections = new InMemoryRoutingSelectionRepository();
    const registry = createRegistry();

    await events.save({
      id: "00000000-0000-4000-8000-000000000020",
      correlationId: "NOA-20260909-000020",
      eventType: "ADMISSION",
      receivedAt: "2026-09-09T18:00:00.000Z",
      contentType: "application/fhir+json",
      processingState: "EVALUATED",
      rawPayload: {},
    });

    const admission: AdmissionEvent = {
      eventId: "00000000-0000-4000-8000-000000000020",
      correlationId: "NOA-20260909-000020",
      sourceSystem: "SYNTHETIC_EHR",
      eventType: "ADMISSION",
      eventTimestamp: "2026-09-09T14:30:00.000Z",
      patient: { name: { family: "SYNTHETIC" } },
      encounter: { class: "INPATIENT" },
      admission: {},
      facility: {},
      payer: { payerType: "MEDICARE" },
      coverage: {},
      diagnoses: [],
      providers: [],
      sourceMetadata: {},
    };

    const decision: Decision = {
      decision: "SEND_NOA",
      notificationRequired: true,
      notificationType: "NOA",
      priority: "HIGH",
      rulesApplied: ["MEDICARE_INPATIENT_NOA"],
      ruleVersions: ["MEDICARE_INPATIENT_NOA@1"],
    };

    const routing = new RoutingService({
      clock,
      logger: new MemoryLogger(),
      registry,
      events,
      selections,
      audit,
    });

    const result = await routing.routeAndPersist(admission, decision);
    expect(result.processingState).toBe("ROUTED");
    expect(result.selection?.contractBusinessId).toBe("MEDICARE_NOA_MOCK_V1");

    const stored = await events.findById(admission.eventId);
    expect(stored?.processingState).toBe("ROUTED");
  });
});

describe("Pipeline FHIR → Contract → Transform", () => {
  it("golden path ends TRANSFORMED with mock payload", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline, audit } = createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      correlationId: "NOA-20260909-000123",
    });

    expect(result.processingState).toBe("ACKNOWLEDGED");
    expect(result.decision?.decision).toBe("SEND_NOA");
    expect(result.routing?.contractBusinessId).toBe("MEDICARE_NOA_MOCK_V1");
    expect(result.routing?.adapterKey).toBe("mock");
    expect(result.transformation?.payload).toMatchObject({
      notificationType: "NOA",
      admissionDateTime: "2026-09-09T14:30:00.000Z",
      patient: { lastName: "SYNTHETIC", firstName: "ADA" },
      encounterClass: "INPATIENT",
      payerType: "MEDICARE",
      correlationId: "NOA-20260909-000123",
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

  it("same FHIR event routes to Salesforce with X-Contract override", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline } = createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      contractBusinessId: "MEDICARE_NOA_SF_V1",
    });

    expect(result.processingState).toBe("ACKNOWLEDGED");
    expect(result.decision?.decision).toBe("SEND_NOA");
    expect(result.routing?.adapterKey).toBe("salesforce");
    expect(result.routing?.destinationCode).toBe("SF_NOA_INBOX");
    expect(result.transformation?.payload).toMatchObject({
      PatientLastName: "SYNTHETIC",
      PatientFirstName: "ADA",
      PayerType__c: "MEDICARE",
    });
  });

  it("same FHIR event routes to Pega with contract override", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline } = createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      contractBusinessId: "MEDICARE_NOA_PEGA_V1",
    });

    expect(result.processingState).toBe("ACKNOWLEDGED");
    expect(result.routing?.adapterKey).toBe("pega");
    expect(result.routing?.destinationCode).toBe("PEGA_NOA_CASE");
    expect(result.transformation?.payload).toMatchObject({
      MemberLastName: "SYNTHETIC",
      AdmissionDateTime: "2026-09-09T14:30:00Z",
    });
  });

  it("outpatient still stops at EVALUATED without routing", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline } = createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-outpatient-no-noa.json"),
      contentType: "application/fhir+json",
    });

    expect(result.processingState).toBe("EVALUATED");
    expect(result.decision?.decision).toBe("NO_NOA_REQUIRED");
    expect(result.routing).toBeUndefined();
    expect(result.transformation).toBeUndefined();
  });
});
