import { randomUUID } from "node:crypto";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision, DecisionRecord } from "@/src/domain/decisions/decision";
import type {
  DeliveryAttemptRecord,
  DeliveryOutcome,
  NotificationRecord,
} from "@/src/domain/delivery/delivery";
import type { DeadLetterRecord } from "@/src/domain/delivery/audit";
import type { RoutingResult } from "@/src/domain/routing/routing";
import type {
  AuditPort,
  Clock,
  DeadLetterRepository,
  DeliveryAdapterRegistry,
  DeliveryAttemptRepository,
  DeliveryService,
  EventRepository,
  Logger,
  NotificationRepository,
} from "@/src/domain/ports";
import type { ProcessingState } from "@/src/domain/types";

export interface DeliveryServiceResult {
  processingState: ProcessingState;
  outcome?: DeliveryOutcome;
  errors?: Array<{ code: string; message: string }>;
}

/**
 * Contract-driven delivery with in-process retries and dead-letter handling.
 */
export class DefaultDeliveryService implements DeliveryService {
  constructor(
    private readonly deps: {
      clock: Clock;
      logger: Logger;
      adapters: DeliveryAdapterRegistry;
      events: EventRepository;
      notifications: NotificationRepository;
      attempts: DeliveryAttemptRepository;
      deadLetters: DeadLetterRepository;
      audit: AuditPort;
    }
  ) {}

  async deliver(input: {
    event: AdmissionEvent;
    decision: Decision;
    routing: RoutingResult;
    payload: Record<string, unknown>;
    decisionRecord?: DecisionRecord;
  }): Promise<DeliveryOutcome> {
    const result = await this.deliverAndPersist(input);
    if (!result.outcome) {
      throw new Error(result.errors?.[0]?.message ?? "Delivery failed");
    }
    return result.outcome;
  }

  async deliverAndPersist(input: {
    event: AdmissionEvent;
    decision: Decision;
    routing: RoutingResult;
    payload: Record<string, unknown>;
    decisionRecord?: DecisionRecord;
  }): Promise<DeliveryServiceResult> {
    const {
      clock,
      logger,
      adapters,
      events,
      notifications,
      attempts,
      deadLetters,
      audit,
    } = this.deps;

    const { event, routing, payload, decisionRecord } = input;
    const retryPolicy = routing.contractVersion.retryPolicy;
    const maxAttempts = Math.max(1, retryPolicy.maxAttempts ?? 3);
    const now = clock.now().toISOString();

    const notification: NotificationRecord = {
      id: randomUUID(),
      eventId: event.eventId,
      correlationId: event.correlationId,
      decisionId: decisionRecord?.id ?? randomUUID(),
      contractVersionId: routing.contractVersion.id,
      destinationId: routing.destination.id,
      transformationVersionId: routing.transformation.id,
      adapterKey: routing.adapterKey,
      requestPayload: payload,
      status: "PENDING",
      createdAt: now,
      updatedAt: now,
    };
    await notifications.save(notification);

    await audit.record({
      correlationId: event.correlationId,
      eventId: event.eventId,
      timestamp: now,
      component: "delivery",
      action: "DELIVERY_STARTED",
      status: "INFO",
      detail: {
        adapterKey: routing.adapterKey,
        destinationCode: routing.destination.code,
        maxAttempts,
      },
      references: { notificationId: notification.id },
    });

    const adapter = adapters.get(routing.adapterKey);
    const attemptRecords: DeliveryAttemptRecord[] = [];

    for (let attemptNumber = 1; attemptNumber <= maxAttempts; attemptNumber++) {
      if (attemptNumber > 1) {
        await events.updateState(event.eventId, "RETRY_PENDING");
        const backoff =
          retryPolicy.backoffMs[attemptNumber - 2] ??
          retryPolicy.backoffMs[retryPolicy.backoffMs.length - 1] ??
          0;
        if (backoff > 0) {
          await sleep(Math.min(backoff, 50)); // cap sleep in POC/tests
        }
      }

      const attemptedAt = clock.now().toISOString();
      const result = await adapter.send({
        correlationId: event.correlationId,
        eventId: event.eventId,
        notificationId: notification.id,
        destination: routing.destination,
        payload,
      });

      const attempt: DeliveryAttemptRecord = {
        id: randomUUID(),
        notificationId: notification.id,
        attemptNumber,
        attemptedAt,
        status: result.success ? "SUCCESS" : "FAILURE",
        statusCode: result.statusCode,
        responseSummary: result.responseBodySummary,
        errorMessage: result.errorMessage,
        retryable: result.retryable,
        nextRetryAt:
          !result.success && result.retryable && attemptNumber < maxAttempts
            ? new Date(
                clock.now().getTime() +
                  (retryPolicy.backoffMs[attemptNumber - 1] ?? 0)
              ).toISOString()
            : null,
        acknowledgement: result.acknowledgement ?? null,
      };
      await attempts.save(attempt);
      attemptRecords.push(attempt);

      await audit.record({
        correlationId: event.correlationId,
        eventId: event.eventId,
        timestamp: clock.now().toISOString(),
        component: "delivery",
        action: "DELIVERY_ATTEMPTED",
        status: result.success ? "SUCCESS" : "FAILURE",
        detail: {
          attemptNumber,
          statusCode: result.statusCode,
          adapterKey: routing.adapterKey,
        },
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        references: { notificationId: notification.id, attemptId: attempt.id },
      });

      if (result.success) {
        await notifications.updateStatus(notification.id, "DELIVERED");
        await events.updateState(event.eventId, "DELIVERED");
        await audit.record({
          correlationId: event.correlationId,
          eventId: event.eventId,
          timestamp: clock.now().toISOString(),
          component: "delivery",
          action: "DELIVERY_SUCCEEDED",
          status: "SUCCESS",
          references: { notificationId: notification.id },
        });

        await notifications.updateStatus(notification.id, "ACKNOWLEDGED");
        await events.updateState(event.eventId, "ACKNOWLEDGED");
        await audit.record({
          correlationId: event.correlationId,
          eventId: event.eventId,
          timestamp: clock.now().toISOString(),
          component: "delivery",
          action: "ACKNOWLEDGEMENT_RECEIVED",
          status: "SUCCESS",
          detail: {
            ackId: result.acknowledgement?.ackId,
          },
          references: { notificationId: notification.id },
        });

        logger.info("Delivery acknowledged", {
          eventId: event.eventId,
          correlationId: event.correlationId,
          adapterKey: routing.adapterKey,
          ackId: result.acknowledgement?.ackId,
        });

        return {
          processingState: "ACKNOWLEDGED",
          outcome: {
            notificationId: notification.id,
            success: true,
            attempts: attemptRecords,
            acknowledgement: result.acknowledgement,
          },
        };
      }

      if (!result.retryable || attemptNumber >= maxAttempts) {
        break;
      }

      logger.warn("Delivery attempt failed; will retry", {
        eventId: event.eventId,
        correlationId: event.correlationId,
        attemptNumber,
      });
    }

    await notifications.updateStatus(notification.id, "DEAD_LETTER");
    await events.updateState(event.eventId, "DEAD_LETTER", "DEAD_LETTER");

    const last = attemptRecords[attemptRecords.length - 1];
    const deadLetter: DeadLetterRecord = {
      id: randomUUID(),
      notificationId: notification.id,
      eventId: event.eventId,
      correlationId: event.correlationId,
      reason: "Max delivery attempts exhausted",
      lastError: last?.errorMessage,
      payloadSnapshot: payload,
      createdAt: clock.now().toISOString(),
    };
    await deadLetters.save(deadLetter);

    await audit.record({
      correlationId: event.correlationId,
      eventId: event.eventId,
      timestamp: clock.now().toISOString(),
      component: "delivery",
      action: "DEAD_LETTERED",
      status: "FAILURE",
      errorCode: "DEAD_LETTER",
      errorMessage: deadLetter.reason,
      references: {
        notificationId: notification.id,
        deadLetterId: deadLetter.id,
      },
    });

    logger.error("Delivery dead-lettered", {
      eventId: event.eventId,
      correlationId: event.correlationId,
      attempts: attemptRecords.length,
    });

    return {
      processingState: "DEAD_LETTER",
      outcome: {
        notificationId: notification.id,
        success: false,
        attempts: attemptRecords,
        deadLetter: true,
      },
      errors: [
        {
          code: "DEAD_LETTER",
          message: last?.errorMessage ?? "Delivery failed after retries",
        },
      ],
    };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
