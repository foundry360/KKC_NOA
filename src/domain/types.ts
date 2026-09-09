/** Shared primitive aliases for the domain layer. */
export type UUID = string;
export type CorrelationId = string;
export type ISODateTime = string;

export type ProcessingState =
  | "RECEIVED"
  | "VALIDATED"
  | "NORMALIZED"
  | "EVALUATED"
  | "ROUTED"
  | "TRANSFORMED"
  | "DELIVERED"
  | "ACKNOWLEDGED"
  | "VALIDATION_FAILED"
  | "RULE_REJECTED"
  | "NO_CONTRACT"
  | "TRANSFORM_FAILED"
  | "DELIVERY_FAILED"
  | "RETRY_PENDING"
  | "DEAD_LETTER";

export const PROCESSING_STATES: readonly ProcessingState[] = [
  "RECEIVED",
  "VALIDATED",
  "NORMALIZED",
  "EVALUATED",
  "ROUTED",
  "TRANSFORMED",
  "DELIVERED",
  "ACKNOWLEDGED",
  "VALIDATION_FAILED",
  "RULE_REJECTED",
  "NO_CONTRACT",
  "TRANSFORM_FAILED",
  "DELIVERY_FAILED",
  "RETRY_PENDING",
  "DEAD_LETTER",
] as const;

export type EventType = "ADMISSION" | string;

export type AdapterKey =
  | "mock"
  | "rest"
  | "salesforce"
  | "pega"
  | "fhir"
  | "webhook"
  | "queue";

export type DecisionOutcome = "SEND_NOA" | "NO_NOA_REQUIRED" | "REJECT";

export type AuditStatus = "SUCCESS" | "FAILURE" | "INFO";
