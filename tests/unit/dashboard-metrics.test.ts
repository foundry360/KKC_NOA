import { describe, expect, it } from "vitest";
import { computeDashboardMetrics } from "@/src/services/metrics/dashboard-metrics";
import type { InboundEvent } from "@/src/domain/events/inbound-event";
import type { DecisionRecord } from "@/src/domain/decisions/decision";
import type { NotificationRecord } from "@/src/domain/delivery/delivery";

describe("dashboard metrics", () => {
  it("aggregates from persisted records", () => {
    const events: InboundEvent[] = [
      {
        id: "1",
        correlationId: "a",
        eventType: "ADMISSION",
        receivedAt: "2026-09-09T18:00:00.000Z",
        contentType: "application/fhir+json",
        processingState: "ACKNOWLEDGED",
        rawPayload: {},
      },
      {
        id: "2",
        correlationId: "b",
        eventType: "ADMISSION",
        receivedAt: "2026-09-09T18:01:00.000Z",
        contentType: "application/fhir+json",
        processingState: "VALIDATION_FAILED",
        rawPayload: {},
      },
      {
        id: "3",
        correlationId: "c",
        eventType: "ADMISSION",
        receivedAt: "2026-09-09T18:02:00.000Z",
        contentType: "application/fhir+json",
        processingState: "ROUTED",
        rawPayload: {},
      },
    ];

    const decisions: DecisionRecord[] = [
      {
        id: "d1",
        eventId: "1",
        correlationId: "a",
        decision: "SEND_NOA",
        notificationRequired: true,
        notificationType: "NOA",
        rulesApplied: ["MEDICARE_INPATIENT_NOA"],
        ruleVersions: ["MEDICARE_INPATIENT_NOA@1"],
        payload: {
          decision: "SEND_NOA",
          notificationRequired: true,
          rulesApplied: [],
          ruleVersions: [],
        },
        createdAt: "2026-09-09T18:00:00.000Z",
      },
    ];

    const notifications: NotificationRecord[] = [
      {
        id: "n1",
        eventId: "1",
        correlationId: "a",
        decisionId: "d1",
        contractVersionId: "c1",
        destinationId: "dest1",
        transformationVersionId: "t1",
        adapterKey: "mock",
        requestPayload: {},
        status: "ACKNOWLEDGED",
        createdAt: "2026-09-09T18:00:00.000Z",
        updatedAt: "2026-09-09T18:00:00.000Z",
      },
    ];

    expect(computeDashboardMetrics({ events, decisions, notifications })).toEqual(
      {
        eventsReceived: 3,
        eventsProcessed: 2,
        noasGenerated: 1,
        delivered: 1,
        failed: 1,
        pending: 1,
      }
    );
  });
});
