import type { Decision } from "@/src/domain/decisions/decision";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { NoaPipeline, PipelineResult } from "@/src/domain/ports";
import type { FhirIngestInput } from "@/src/services/fhir/ingestion-service";
import { FhirIngestionService } from "@/src/services/fhir/ingestion-service";
import { DecisioningService } from "@/src/services/decisioning/decisioning-service";
import { RoutingService } from "@/src/services/routing/routing-service";
import { TransformationService } from "@/src/services/transformation/transformation-service";
import { DefaultDeliveryService } from "@/src/services/delivery/delivery-service";

export type PipelineProcessInput = FhirIngestInput & {
  contractBusinessId?: string;
};

/**
 * Orchestrates FHIR ingest → rules → routing → transform → delivery.
 */
export class DefaultNoaPipeline implements NoaPipeline {
  constructor(
    private readonly ingestion: FhirIngestionService,
    private readonly decisioning: DecisioningService,
    private readonly routing: RoutingService,
    private readonly transformation: TransformationService,
    private readonly delivery: DefaultDeliveryService
  ) {}

  async process(input: PipelineProcessInput): Promise<PipelineResult> {
    const ingestResult = await this.ingestion.ingest(input);

    if (
      ingestResult.processingState !== "NORMALIZED" ||
      !ingestResult.admissionEvent
    ) {
      return {
        eventId: ingestResult.eventId,
        correlationId: ingestResult.correlationId,
        processingState: ingestResult.processingState,
        errors: ingestResult.errors,
      };
    }

    const decisionResult = await this.decisioning.evaluate(
      ingestResult.admissionEvent
    );

    if (
      decisionResult.processingState !== "EVALUATED" ||
      decisionResult.decision.decision !== "SEND_NOA"
    ) {
      return {
        eventId: ingestResult.eventId,
        correlationId: ingestResult.correlationId,
        processingState: decisionResult.processingState,
        decision: decisionResult.decision,
      };
    }

    const routingResult = await this.routing.routeAndPersist(
      ingestResult.admissionEvent,
      decisionResult.decision,
      { contractBusinessId: input.contractBusinessId }
    );

    if (
      routingResult.processingState !== "ROUTED" ||
      !routingResult.routing ||
      !routingResult.selection
    ) {
      return {
        eventId: ingestResult.eventId,
        correlationId: ingestResult.correlationId,
        processingState: routingResult.processingState,
        decision: decisionResult.decision,
      };
    }

    const transformResult = await this.transformation.transformAndPersist(
      ingestResult.admissionEvent,
      decisionResult.decision,
      routingResult.routing
    );

    const base = {
      eventId: ingestResult.eventId,
      correlationId: ingestResult.correlationId,
      decision: decisionResult.decision,
      routing: {
        contractBusinessId: routingResult.selection.contractBusinessId,
        destinationCode: routingResult.selection.destinationCode,
        adapterKey: routingResult.selection.adapterKey,
        transformerCode: routingResult.selection.transformerCode,
      },
      ...(transformResult.record
        ? {
            transformation: {
              transformerCode: transformResult.record.transformerCode,
              payload: transformResult.record.payload,
            },
          }
        : {}),
    };

    if (
      transformResult.processingState !== "TRANSFORMED" ||
      !transformResult.record ||
      !routingResult.routing
    ) {
      return {
        ...base,
        processingState: transformResult.processingState,
        ...(transformResult.errors ? { errors: transformResult.errors } : {}),
      };
    }

    const deliveryResult = await this.delivery.deliverAndPersist({
      event: ingestResult.admissionEvent,
      decision: decisionResult.decision,
      routing: routingResult.routing,
      payload: transformResult.record.payload,
      decisionRecord: decisionResult.decisionRecord,
    });

    return {
      ...base,
      processingState: deliveryResult.processingState,
      ...(deliveryResult.outcome
        ? {
            delivery: {
              notificationId: deliveryResult.outcome.notificationId,
              adapterKey: routingResult.selection.adapterKey,
              attempts: deliveryResult.outcome.attempts.length,
              acknowledgement: deliveryResult.outcome.acknowledgement,
              deadLetter: deliveryResult.outcome.deadLetter,
            },
            acknowledgement: deliveryResult.outcome.acknowledgement,
          }
        : {}),
      ...(deliveryResult.errors ? { errors: deliveryResult.errors } : {}),
    };
  }
}

export type { Decision, AdmissionEvent };
