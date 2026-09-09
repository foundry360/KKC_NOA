import { randomUUID } from "node:crypto";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision } from "@/src/domain/decisions/decision";
import type { RoutingResult } from "@/src/domain/routing/routing";
import type {
  MappingTraceEntry,
  TransformResult,
} from "@/src/domain/transformations/transformation";
import type {
  AuditPort,
  Clock,
  EventRepository,
  Logger,
  TransformationEngine,
} from "@/src/domain/ports";
import type { ProcessingState, UUID } from "@/src/domain/types";
import { TransformFailedError } from "./mapping-engine";

export interface TransformationRecord {
  id: UUID;
  eventId: UUID;
  correlationId: string;
  transformerCode: string;
  transformerVersion: number;
  payload: Record<string, unknown>;
  mappingTrace: MappingTraceEntry[];
  createdAt: string;
}

export interface TransformationResultRepository {
  save(record: TransformationRecord): Promise<void>;
  findByEventId(eventId: UUID): Promise<TransformationRecord | null>;
}

export interface TransformationServiceResult {
  processingState: ProcessingState;
  transform?: TransformResult;
  record?: TransformationRecord;
  errors?: Array<{ code: string; message: string }>;
}

/**
 * Runs contract-selected transformation and persists the destination payload.
 */
export class TransformationService {
  constructor(
    private readonly deps: {
      clock: Clock;
      logger: Logger;
      engine: TransformationEngine;
      events: EventRepository;
      results: TransformationResultRepository;
      audit: AuditPort;
    }
  ) {}

  async transformAndPersist(
    event: AdmissionEvent,
    decision: Decision,
    routing: RoutingResult
  ): Promise<TransformationServiceResult> {
    const { clock, logger, engine, events, results, audit } = this.deps;

    try {
      const transformResult = await engine.transform(
        event,
        routing.transformation,
        decision
      );

      const record: TransformationRecord = {
        id: randomUUID(),
        eventId: event.eventId,
        correlationId: event.correlationId,
        transformerCode: routing.transformation.code,
        transformerVersion: routing.transformation.version,
        payload: transformResult.payload,
        mappingTrace: transformResult.mappingTrace,
        createdAt: clock.now().toISOString(),
      };
      await results.save(record);

      await events.updateState(event.eventId, "TRANSFORMED");
      await audit.record({
        correlationId: event.correlationId,
        eventId: event.eventId,
        timestamp: clock.now().toISOString(),
        component: "transformation",
        action: "TRANSFORM_EXECUTED",
        status: "SUCCESS",
        detail: {
          transformerCode: record.transformerCode,
          mappedCount: transformResult.mappingTrace.filter(
            (t) => t.status === "MAPPED" || t.status === "DEFAULT"
          ).length,
        },
        references: { transformationRecordId: record.id },
      });

      logger.info("Transformation executed", {
        eventId: event.eventId,
        correlationId: event.correlationId,
        transformerCode: record.transformerCode,
      });

      return {
        processingState: "TRANSFORMED",
        transform: transformResult,
        record,
      };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Transformation failed";
      const details =
        error instanceof TransformFailedError ? error.details : undefined;

      await events.updateState(
        event.eventId,
        "TRANSFORM_FAILED",
        "TRANSFORM_FAILED"
      );
      await audit.record({
        correlationId: event.correlationId,
        eventId: event.eventId,
        timestamp: clock.now().toISOString(),
        component: "transformation",
        action: "TRANSFORM_EXECUTED",
        status: "FAILURE",
        errorCode: "TRANSFORM_FAILED",
        errorMessage: message,
        detail: details,
      });

      logger.error("Transformation failed", {
        eventId: event.eventId,
        correlationId: event.correlationId,
      });

      return {
        processingState: "TRANSFORM_FAILED",
        errors: [{ code: "TRANSFORM_FAILED", message }],
      };
    }
  }
}
