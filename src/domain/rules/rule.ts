import type { UUID } from "../types";

export type RuleOperator =
  | "eq"
  | "neq"
  | "in"
  | "notIn"
  | "exists"
  | "gt"
  | "gte"
  | "lt"
  | "lte";

export interface RuleConditionLeaf {
  path: string;
  op: RuleOperator;
  value?: unknown;
}

export interface RuleConditionGroup {
  all?: RuleCondition[];
  any?: RuleCondition[];
  not?: RuleCondition;
}

export type RuleCondition = RuleConditionLeaf | RuleConditionGroup;

export interface RuleActions {
  decision: string;
  notificationRequired?: boolean;
  notificationType?: string;
  priority?: string;
  [key: string]: unknown;
}

export interface RuleVersion {
  id: UUID;
  ruleId: UUID;
  name: string;
  version: number;
  priority: number;
  effectiveDate: string;
  expirationDate?: string | null;
  conditions: RuleCondition;
  actions: RuleActions;
}
