import type { CorrelationId, AuditStatus, UUID } from "../types";

export interface AuditEntry {
  id?: UUID;
  correlationId: CorrelationId;
  eventId?: UUID;
  timestamp: string;
  component: string;
  action: string;
  status: AuditStatus;
  detail?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  references?: Record<string, unknown>;
}

export interface DeadLetterRecord {
  id: UUID;
  notificationId: UUID;
  eventId: UUID;
  correlationId: CorrelationId;
  reason: string;
  lastError?: string;
  payloadSnapshot?: Record<string, unknown>;
  createdAt: string;
}
