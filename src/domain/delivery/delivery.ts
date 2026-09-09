import type { CorrelationId, UUID } from "../types";

export interface Acknowledgement {
  acknowledgedAt: string;
  ackId?: string;
  rawSummary?: string;
}

export interface DeliveryRequest {
  correlationId: CorrelationId;
  eventId: UUID;
  notificationId: UUID;
  destination: {
    id: UUID;
    code: string;
    adapterKey: string;
    endpoint?: string;
    authType?: string;
    authConfig?: Record<string, string>;
    simulation?: {
      failAttempts?: number;
      statusCode?: number;
      timeout?: boolean;
    };
  };
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  acknowledgement?: Acknowledgement;
  responseBodySummary?: string;
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

export interface DeliveryAttemptRecord {
  id: UUID;
  notificationId: UUID;
  attemptNumber: number;
  attemptedAt: string;
  status: "SUCCESS" | "FAILURE";
  statusCode?: number;
  responseSummary?: string;
  errorMessage?: string;
  retryable?: boolean;
  nextRetryAt?: string | null;
  acknowledgement?: Acknowledgement | null;
}

export interface NotificationRecord {
  id: UUID;
  eventId: UUID;
  correlationId: CorrelationId;
  decisionId: UUID;
  contractVersionId: UUID;
  destinationId: UUID;
  transformationVersionId: string;
  adapterKey: string;
  requestPayload: Record<string, unknown>;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeliveryOutcome {
  notificationId: UUID;
  success: boolean;
  attempts: DeliveryAttemptRecord[];
  acknowledgement?: Acknowledgement;
  deadLetter?: boolean;
}
