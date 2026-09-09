import type { InboundEvent } from "@/src/domain/events/inbound-event";
import type { DecisionRecord } from "@/src/domain/decisions/decision";
import type { NotificationRecord } from "@/src/domain/delivery/delivery";
import type { ProcessingState } from "@/src/domain/types";

const FAILED_STATES: ProcessingState[] = [
  "VALIDATION_FAILED",
  "RULE_REJECTED",
  "NO_CONTRACT",
  "TRANSFORM_FAILED",
  "DELIVERY_FAILED",
  "DEAD_LETTER",
];

const PENDING_STATES: ProcessingState[] = [
  "RECEIVED",
  "VALIDATED",
  "NORMALIZED",
  "EVALUATED",
  "ROUTED",
  "TRANSFORMED",
  "DELIVERED",
  "RETRY_PENDING",
];

export interface DashboardMetrics {
  eventsReceived: number;
  eventsProcessed: number;
  noasGenerated: number;
  delivered: number;
  failed: number;
  pending: number;
}

export function computeDashboardMetrics(input: {
  events: InboundEvent[];
  decisions: DecisionRecord[];
  notifications: NotificationRecord[];
}): DashboardMetrics {
  const { events, decisions, notifications } = input;

  return {
    eventsReceived: events.length,
    eventsProcessed: events.filter(
      (e) =>
        e.processingState === "ACKNOWLEDGED" ||
        (e.processingState === "EVALUATED" &&
          decisions.some(
            (d) =>
              d.eventId === e.id && d.decision === "NO_NOA_REQUIRED"
          )) ||
        FAILED_STATES.includes(e.processingState)
    ).length,
    noasGenerated: decisions.filter((d) => d.decision === "SEND_NOA").length,
    delivered: notifications.filter((n) => n.status === "ACKNOWLEDGED").length,
    failed: events.filter((e) => FAILED_STATES.includes(e.processingState))
      .length,
    pending: events.filter((e) => PENDING_STATES.includes(e.processingState))
      .length,
  };
}
