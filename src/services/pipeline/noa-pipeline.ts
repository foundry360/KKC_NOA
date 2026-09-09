import type { Decision } from "@/src/domain/decisions/decision";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { NoaPipeline, PipelineResult } from "@/src/domain/ports";
import type { FhirIngestInput } from "@/src/services/fhir/ingestion-service";
import { FhirIngestionService } from "@/src/services/fhir/ingestion-service";
import { DecisioningService } from "@/src/services/decisioning/decisioning-service";

/**
 * Orchestrates FHIR ingest then rules decisioning.
 * Route handlers depend on this — not on rules directly.
 */
export class DefaultNoaPipeline implements NoaPipeline {
  constructor(
    private readonly ingestion: FhirIngestionService,
    private readonly decisioning: DecisioningService
  ) {}

  async process(input: FhirIngestInput): Promise<PipelineResult> {
    const ingestResult = await this.ingestion.ingest(input);

    if (ingestResult.processingState !== "NORMALIZED" || !ingestResult.admissionEvent) {
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

    return {
      eventId: ingestResult.eventId,
      correlationId: ingestResult.correlationId,
      processingState: decisionResult.processingState,
      decision: decisionResult.decision,
    };
  }
}

export type { Decision, AdmissionEvent };
