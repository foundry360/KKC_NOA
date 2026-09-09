import type { CorrelationId, DecisionOutcome, UUID } from "../types";

export interface Decision {
  decision: DecisionOutcome;
  notificationRequired: boolean;
  notificationType?: string;
  priority?: string;
  rulesApplied: string[];
  ruleVersions: string[];
}

export interface DecisionRecord extends Decision {
  id: UUID;
  eventId: UUID;
  correlationId: CorrelationId;
  payload: Decision;
  createdAt: string;
}
