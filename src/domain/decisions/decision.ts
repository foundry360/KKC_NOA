import type { CorrelationId, DecisionOutcome, UUID } from "../types";
import type {
  AuthorizationRequirement,
  NotificationWindow,
  PayerRequirementEvidence,
} from "../payer-requirements/types";

export type RequirementDecision =
  | "NOTIFICATION_REQUIRED"
  | "NOTIFICATION_NOT_REQUIRED"
  | "AUTHORIZATION_REQUIRED"
  | "AUTHORIZATION_NOT_REQUIRED"
  | "NOTIFICATION_AND_AUTHORIZATION_REQUIRED"
  | "UNKNOWN";

export type NotificationTimingStatus =
  | "DUE"
  | "OVERDUE"
  | "NOT_REQUIRED"
  | "UNKNOWN";

export interface DecisionExplanation {
  requirementOutcome?: RequirementDecision;
  authorizationRequirement?: AuthorizationRequirement;
  notificationWindow?: NotificationWindow | "UNKNOWN";
  notificationTimingStatus?: NotificationTimingStatus;
  reason?: string;
  sources?: PayerRequirementEvidence[];
  conflict?: boolean;
  conflictRuleIds?: string[];
  transactionKinds?: {
    notification?: string;
    authorization?: string;
    claim?: string;
  };
}

export interface Decision {
  decision: DecisionOutcome;
  notificationRequired: boolean;
  notificationType?: string;
  priority?: string;
  rulesApplied: string[];
  ruleVersions: string[];
  explanation?: DecisionExplanation;
}

export interface DecisionRecord extends Decision {
  id: UUID;
  eventId: UUID;
  correlationId: CorrelationId;
  payload: Decision;
  createdAt: string;
}
