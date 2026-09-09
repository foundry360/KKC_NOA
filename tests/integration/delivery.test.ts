import { describe, expect, it } from "vitest";
import { MockDeliveryAdapter } from "@/src/adapters/mock/mock-delivery-adapter";
import { RestDeliveryAdapter } from "@/src/adapters/rest/rest-delivery-adapter";
import { FixedClock } from "@/src/utils/clock";
import { MemoryLogger } from "@/src/utils/logger";
import { createTestPipeline } from "../helpers/test-pipeline";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  InMemoryAuditPort,
  InMemoryEventRepository,
} from "@/src/infrastructure/memory";
import {
  InMemoryDeadLetterRepository,
  InMemoryDeliveryAttemptRepository,
  InMemoryNotificationRepository,
} from "@/src/infrastructure/memory/delivery-repositories";
import { DefaultDeliveryAdapterRegistry } from "@/src/adapters/registry";
import { DefaultDeliveryService } from "@/src/services/delivery/delivery-service";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision } from "@/src/domain/decisions/decision";
import type { RoutingResult } from "@/src/domain/routing/routing";
import { SEED_DESTINATIONS, SEED_CONTRACTS } from "@/src/infrastructure/seed/contracts";
import { createSeedTransformations } from "@/src/infrastructure/seed/transformations";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "fhir", "fixtures", name), "utf8")
  );
}

describe("Delivery adapters", () => {
  it("Mock adapter returns acknowledgement", async () => {
    const adapter = new MockDeliveryAdapter();
    const result = await adapter.send({
      correlationId: "NOA-20260909-000001",
      eventId: "e1",
      notificationId: "n1",
      destination: {
        id: "d1",
        code: "MOCK_PAYER",
        adapterKey: "mock",
      },
      payload: { hello: "world" },
    });
    expect(result.success).toBe(true);
    expect(result.acknowledgement?.ackId).toMatch(/^ACK-MOCK-/);
  });

  it("Mock adapter simulates retryable failures then can succeed", async () => {
    const adapter = new MockDeliveryAdapter();
    const dest = {
      id: "d1",
      code: "MOCK_FAIL",
      adapterKey: "mock",
      simulation: { failAttempts: 2, statusCode: 503 },
    };

    const first = await adapter.send({
      correlationId: "c",
      eventId: "e",
      notificationId: "n-fail",
      destination: dest,
      payload: {},
    });
    expect(first.success).toBe(false);
    expect(first.retryable).toBe(true);

    const second = await adapter.send({
      correlationId: "c",
      eventId: "e",
      notificationId: "n-fail",
      destination: dest,
      payload: {},
    });
    expect(second.success).toBe(false);

    const third = await adapter.send({
      correlationId: "c",
      eventId: "e",
      notificationId: "n-fail",
      destination: dest,
      payload: {},
    });
    expect(third.success).toBe(true);
  });

  it("REST adapter posts to fetch implementation", async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ ackId: "ACK-REST-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });

    const adapter = new RestDeliveryAdapter(fetchImpl, "https://example.test/noa");
    const result = await adapter.send({
      correlationId: "c",
      eventId: "e",
      notificationId: "n",
      destination: {
        id: "d",
        code: "REST",
        adapterKey: "rest",
        endpoint: "https://example.test/noa",
      },
      payload: { a: 1 },
    });

    expect(result.success).toBe(true);
    expect(result.acknowledgement?.ackId).toBe("ACK-REST-1");
  });
});

describe("DeliveryService retry + dead letter", () => {
  it("retries then dead-letters when all attempts fail", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const events = new InMemoryEventRepository();
    const audit = new InMemoryAuditPort();
    const notifications = new InMemoryNotificationRepository();
    const attempts = new InMemoryDeliveryAttemptRepository();
    const deadLetters = new InMemoryDeadLetterRepository();
    const mock = new MockDeliveryAdapter();
    const adapters = new DefaultDeliveryAdapterRegistry();
    adapters.register(mock);

    await events.save({
      id: "00000000-0000-4000-8000-000000000040",
      correlationId: "NOA-20260909-000040",
      eventType: "ADMISSION",
      receivedAt: "2026-09-09T18:00:00.000Z",
      contentType: "application/fhir+json",
      processingState: "TRANSFORMED",
      rawPayload: {},
    });

    const destination = {
      ...SEED_DESTINATIONS[0]!,
      simulation: { failAttempts: 99, statusCode: 500 },
    };
    const contract = SEED_CONTRACTS[0]!;
    const transform = createSeedTransformations()[0]!;

    const routing: RoutingResult = {
      destination,
      contractVersion: { ...contract, retryPolicy: { maxAttempts: 3, backoffMs: [0, 0, 0], deadLetterAfterMax: true } },
      transformation: transform,
      adapterKey: "mock",
    };

    const admission: AdmissionEvent = {
      eventId: "00000000-0000-4000-8000-000000000040",
      correlationId: "NOA-20260909-000040",
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
      rulesApplied: [],
      ruleVersions: [],
    };

    const delivery = new DefaultDeliveryService({
      clock,
      logger: new MemoryLogger(),
      adapters,
      events,
      notifications,
      attempts,
      deadLetters,
      audit,
    });

    const result = await delivery.deliverAndPersist({
      event: admission,
      decision,
      routing,
      payload: { notificationType: "NOA" },
    });

    expect(result.processingState).toBe("DEAD_LETTER");
    expect(result.outcome?.attempts).toHaveLength(3);
    expect(deadLetters.listAll()).toHaveLength(1);
    expect((await events.findById(admission.eventId))?.processingState).toBe(
      "DEAD_LETTER"
    );
  });
});

describe("Pipeline FHIR → Delivery", () => {
  it("golden path ends ACKNOWLEDGED with mock ack", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline, audit, notifications, attempts } = createTestPipeline(
      clock,
      new MemoryLogger()
    );

    const result = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      correlationId: "NOA-20260909-000123",
    });

    expect(result.processingState).toBe("ACKNOWLEDGED");
    expect(result.acknowledgement?.ackId).toMatch(/^ACK-MOCK-/);
    expect(result.delivery?.attempts).toBe(1);

    const notification = await notifications.findByEventId(result.eventId);
    expect(notification?.status).toBe("ACKNOWLEDGED");
    const tries = await attempts.listByNotificationId(notification!.id);
    expect(tries).toHaveLength(1);

    const trail = await audit.listByCorrelationId(result.correlationId);
    expect(trail.map((e) => e.action)).toContain("ACKNOWLEDGEMENT_RECEIVED");
    expect(trail.map((e) => e.action)).toContain("DELIVERY_SUCCEEDED");
  });

  it("Salesforce contract delivers via salesforce adapter", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline } = createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      contractBusinessId: "MEDICARE_NOA_SF_V1",
    });

    expect(result.processingState).toBe("ACKNOWLEDGED");
    expect(result.routing?.adapterKey).toBe("salesforce");
    expect(result.acknowledgement?.ackId).toMatch(/^ACK-SF-/);
  });
});
