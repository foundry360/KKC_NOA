import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { InboundEvent } from "@/src/domain/events/inbound-event";
import type {
  AdmissionEventRepository,
  AuditPort,
  Clock,
  FhirValidator,
  IdGenerator,
  Logger,
  NormalizationService,
  EventRepository,
} from "@/src/domain/ports";
import type { CorrelationId, ProcessingState, UUID } from "@/src/domain/types";
import { ValidationError } from "@/src/domain/errors/app-error";

export const ALLOWED_FHIR_CONTENT_TYPES = [
  "application/fhir+json",
  "application/json",
] as const;

export interface FhirIngestInput {
  rawBody: unknown;
  contentType: string;
  correlationId?: string;
  sourceSystem?: string;
}

export interface FhirIngestResult {
  eventId: UUID;
  correlationId: CorrelationId;
  processingState: ProcessingState;
  admissionEvent?: AdmissionEvent;
  errors?: Array<{ code: string; message: string; path?: string }>;
}

function normalizeContentType(contentType: string): string {
  return contentType.split(";")[0]?.trim().toLowerCase() ?? "";
}

export function isAllowedFhirContentType(contentType: string): boolean {
  const normalized = normalizeContentType(contentType);
  return (ALLOWED_FHIR_CONTENT_TYPES as readonly string[]).includes(normalized);
}

/**
 * FHIR edge ingestion through NORMALIZED.
 * Does not evaluate NOA business rules.
 */
export class FhirIngestionService {
  constructor(
    private readonly deps: {
      ids: IdGenerator;
      clock: Clock;
      logger: Logger;
      events: EventRepository;
      admissions: AdmissionEventRepository;
      audit: AuditPort;
      validator: FhirValidator;
      normalizer: NormalizationService;
    }
  ) {}

  async ingest(input: FhirIngestInput): Promise<FhirIngestResult> {
    const { ids, clock, logger, events, admissions, audit, validator, normalizer } =
      this.deps;

    if (!isAllowedFhirContentType(input.contentType)) {
      throw new ValidationError("Unsupported content type", {
        contentType: input.contentType,
        allowed: [...ALLOWED_FHIR_CONTENT_TYPES],
      });
    }

    const eventId = ids.eventId();
    const correlationId =
      (input.correlationId?.trim() || ids.correlationId()) as CorrelationId;
    const receivedAt = clock.now().toISOString();
    const sourceSystem = input.sourceSystem?.trim() || "SYNTHETIC_EHR";

    const inbound: InboundEvent = {
      id: eventId,
      correlationId,
      eventType: "ADMISSION",
      sourceSystemCode: sourceSystem,
      receivedAt,
      contentType: normalizeContentType(input.contentType),
      processingState: "RECEIVED",
      rawPayload: input.rawBody,
      createdAt: receivedAt,
      updatedAt: receivedAt,
    };

    await events.save(inbound);
    await audit.record({
      correlationId,
      eventId,
      timestamp: receivedAt,
      component: "fhir-ingestion",
      action: "EVENT_RECEIVED",
      status: "SUCCESS",
      detail: { contentType: inbound.contentType, sourceSystem },
    });

    logger.info("FHIR event received", { eventId, correlationId });

    const validation = await validator.validate(input.rawBody);
    if (!validation.ok) {
      const errorSummary = validation.errors
        .map((e) => e.code)
        .slice(0, 8)
        .join(",");
      await events.updateState(eventId, "VALIDATION_FAILED", errorSummary);
      await audit.record({
        correlationId,
        eventId,
        timestamp: clock.now().toISOString(),
        component: "fhir-validation",
        action: "FHIR_VALIDATED",
        status: "FAILURE",
        errorCode: "VALIDATION_FAILED",
        errorMessage: "FHIR validation failed",
        detail: {
          errorCodes: validation.errors.map((e) => e.code),
          errorCount: validation.errors.length,
        },
      });

      logger.warn("FHIR validation failed", {
        eventId,
        correlationId,
        errorCount: validation.errors.length,
      });

      return {
        eventId,
        correlationId,
        processingState: "VALIDATION_FAILED",
        errors: validation.errors,
      };
    }

    await events.updateState(eventId, "VALIDATED");
    await audit.record({
      correlationId,
      eventId,
      timestamp: clock.now().toISOString(),
      component: "fhir-validation",
      action: "FHIR_VALIDATED",
      status: "SUCCESS",
    });

    const admissionEvent = await normalizer.toAdmissionEvent(input.rawBody, {
      eventId,
      correlationId,
      sourceSystem,
    });

    await admissions.save(admissionEvent);
    await events.updateState(eventId, "NORMALIZED");
    await audit.record({
      correlationId,
      eventId,
      timestamp: clock.now().toISOString(),
      component: "normalization",
      action: "NORMALIZED",
      status: "SUCCESS",
      detail: {
        encounterClass: admissionEvent.encounter.class,
        payerType: admissionEvent.payer.payerType,
      },
    });

    logger.info("FHIR event normalized", {
      eventId,
      correlationId,
      processingState: "NORMALIZED",
    });

    return {
      eventId,
      correlationId,
      processingState: "NORMALIZED",
      admissionEvent,
    };
  }
}
