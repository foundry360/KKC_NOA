import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { FixedClock } from "@/src/utils/clock";
import { MemoryLogger } from "@/src/utils/logger";
import { createTestPipeline } from "../helpers/test-pipeline";
import { computeDashboardMetrics } from "@/src/services/metrics/dashboard-metrics";

function loadFixture(name: string): unknown {
  return JSON.parse(
    readFileSync(path.join(process.cwd(), "fhir", "fixtures", name), "utf8")
  );
}

describe("E2E golden path and exceptions", () => {
  it("completes FHIR → ACKNOWLEDGED with full audit trail", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline, audit, events, decisions, notifications, attempts } =
      createTestPipeline(clock, new MemoryLogger());

    const result = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      correlationId: "NOA-20260909-E2E001",
    });

    expect(result.processingState).toBe("ACKNOWLEDGED");
    expect(result.decision?.decision).toBe("SEND_NOA");
    expect(result.routing?.adapterKey).toBe("mock");
    expect(result.transformation?.payload).toMatchObject({
      patient: { lastName: "SYNTHETIC" },
      payerType: "MEDICARE",
    });
    expect(result.acknowledgement?.ackId).toMatch(/^ACK-MOCK-/);

    const stored = await events.findById(result.eventId);
    expect(stored?.processingState).toBe("ACKNOWLEDGED");
    expect(await decisions.findByEventId(result.eventId)).toBeTruthy();
    const notification = await notifications.findByEventId(result.eventId);
    expect(notification?.status).toBe("ACKNOWLEDGED");
    expect(await attempts.listByNotificationId(notification!.id)).toHaveLength(1);

    const actions = (await audit.listByCorrelationId(result.correlationId)).map(
      (e) => e.action
    );
    expect(actions).toEqual([
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

  it("routes the same admission to Salesforce without changing core decision", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline } = createTestPipeline(clock, new MemoryLogger());

    const mockRun = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
    });
    const sfRun = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      contractBusinessId: "MEDICARE_NOA_SF_V1",
    });
    const pegaRun = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
      contractBusinessId: "MEDICARE_NOA_PEGA_V1",
    });

    expect(mockRun.decision?.decision).toBe("SEND_NOA");
    expect(sfRun.decision?.decision).toBe("SEND_NOA");
    expect(pegaRun.decision?.decision).toBe("SEND_NOA");
    expect(mockRun.routing?.adapterKey).toBe("mock");
    expect(sfRun.routing?.adapterKey).toBe("salesforce");
    expect(pegaRun.routing?.adapterKey).toBe("pega");
    expect(sfRun.acknowledgement?.ackId).toMatch(/^ACK-SF-/);
    expect(pegaRun.acknowledgement?.ackId).toMatch(/^ACK-PEGA-/);
  });

  it("covers invalid FHIR, NOA not required, and dashboard metrics", async () => {
    const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));
    const { pipeline, events, decisions, notifications } = createTestPipeline(
      clock,
      new MemoryLogger()
    );

    const invalid = await pipeline.process({
      rawBody: loadFixture("admission-invalid-missing-patient.json"),
      contentType: "application/fhir+json",
    });
    expect(invalid.processingState).toBe("VALIDATION_FAILED");

    const outpatient = await pipeline.process({
      rawBody: loadFixture("admission-outpatient-no-noa.json"),
      contentType: "application/fhir+json",
    });
    expect(outpatient.processingState).toBe("EVALUATED");
    expect(outpatient.decision?.decision).toBe("NO_NOA_REQUIRED");

    const golden = await pipeline.process({
      rawBody: loadFixture("admission-medicare-inpatient.json"),
      contentType: "application/fhir+json",
    });
    expect(golden.processingState).toBe("ACKNOWLEDGED");

    const allEvents = await events.listRecent(50);
    const allDecisions = (
      await Promise.all(allEvents.map((e) => decisions.findByEventId(e.id)))
    ).filter((d): d is NonNullable<typeof d> => Boolean(d));

    const metrics = computeDashboardMetrics({
      events: allEvents,
      decisions: allDecisions,
      notifications: await notifications.listAll(),
    });

    expect(metrics.eventsReceived).toBe(3);
    expect(metrics.noasGenerated).toBe(1);
    expect(metrics.delivered).toBe(1);
    expect(metrics.failed).toBe(1);
  });
});
