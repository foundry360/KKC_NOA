import type { CorrelationId, EventType, ISODateTime, ProcessingState, UUID } from "../types";

/** Inbound event envelope — FHIR retained for traceability, not as the business model. */
export interface InboundEvent {
  id: UUID;
  correlationId: CorrelationId;
  eventType: EventType;
  sourceSystemId?: UUID | null;
  sourceSystemCode?: string;
  receivedAt: ISODateTime;
  contentType: string;
  processingState: ProcessingState;
  rawPayload: unknown;
  errorSummary?: string | null;
  createdAt?: ISODateTime;
  updatedAt?: ISODateTime;
}
