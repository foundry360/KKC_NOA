import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type {
  Decision,
  DecisionExplanation,
  RequirementDecision,
} from "@/src/domain/decisions/decision";
import type { DecisionOutcome } from "@/src/domain/types";
import type { RuleActions, RuleVersion } from "@/src/domain/rules/rule";
import type {
  RulesEngine,
  RuleRepository,
} from "@/src/domain/ports";
import type { EvaluationContext } from "@/src/domain/routing/routing";
import type {
  AuthorizationRequirement,
  NotificationWindow,
  PayerRequirementEvidence,
} from "@/src/domain/payer-requirements/types";
import { evaluateCondition } from "./condition-evaluator";
import { evaluateNotificationTiming } from "./notification-timing";

const DECISION_OUTCOMES: DecisionOutcome[] = [
  "SEND_NOA",
  "NO_NOA_REQUIRED",
  "REJECT",
];

function asDecisionOutcome(value: unknown): DecisionOutcome | undefined {
  if (typeof value !== "string") return undefined;
  return DECISION_OUTCOMES.includes(value as DecisionOutcome)
    ? (value as DecisionOutcome)
    : undefined;
}

/** Higher numeric priority wins on conflicting action keys. */
export function mergeActions(
  matched: Array<{ priority: number; actions: RuleActions }>
): RuleActions {
  const sorted = [...matched].sort((a, b) => a.priority - b.priority);
  const merged: RuleActions = { decision: "NO_NOA_REQUIRED" };
  for (const item of sorted) {
    Object.assign(merged, item.actions);
  }
  return merged;
}

function detectDecisionConflict(
  matched: RuleVersion[]
): { conflict: boolean; conflictRuleIds: string[] } {
  if (matched.length < 2) return { conflict: false, conflictRuleIds: [] };
  const maxPriority = Math.max(...matched.map((m) => m.priority));
  const top = matched.filter((m) => m.priority === maxPriority);
  if (top.length < 2) return { conflict: false, conflictRuleIds: [] };

  const decisions = new Set(
    top.map((m) => String(m.actions.decision ?? ""))
  );
  if (decisions.size <= 1) return { conflict: false, conflictRuleIds: [] };

  return {
    conflict: true,
    conflictRuleIds: top.map((m) => m.name),
  };
}

function asEvidence(value: unknown): PayerRequirementEvidence | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  if (typeof v.source !== "string" || typeof v.sourceUrl !== "string") {
    return undefined;
  }
  return value as PayerRequirementEvidence;
}

function buildExplanation(
  merged: RuleActions,
  matched: RuleVersion[],
  event: AdmissionEvent,
  asOf: Date,
  conflict: { conflict: boolean; conflictRuleIds: string[] }
): DecisionExplanation {
  const sources: PayerRequirementEvidence[] = [];
  for (const m of matched) {
    const ev = asEvidence(m.actions.provenance ?? m.actions.sourceEvidence);
    if (ev) sources.push(ev);
  }

  const windowRaw = merged.notificationWindow;
  const notificationWindow =
    windowRaw === "UNKNOWN"
      ? "UNKNOWN"
      : windowRaw && typeof windowRaw === "object"
        ? (windowRaw as NotificationWindow)
        : undefined;

  const authorizationRequirement =
    typeof merged.authorizationRequirement === "string"
      ? (merged.authorizationRequirement as AuthorizationRequirement)
      : undefined;

  const requirementOutcome =
    typeof merged.requirementOutcome === "string"
      ? (merged.requirementOutcome as RequirementDecision)
      : undefined;

  const timing = evaluateNotificationTiming(
    notificationWindow,
    event.admission.admissionDateTime,
    asOf
  );

  return {
    requirementOutcome,
    authorizationRequirement,
    notificationWindow,
    notificationTimingStatus: timing,
    reason:
      typeof merged.reason === "string"
        ? merged.reason
        : conflict.conflict
          ? "Conflicting rules at the same specificity/priority require resolution."
          : undefined,
    sources: sources.length ? sources : undefined,
    conflict: conflict.conflict || undefined,
    conflictRuleIds: conflict.conflict ? conflict.conflictRuleIds : undefined,
    transactionKinds: {
      notification: "ADMISSION_NOTIFICATION",
      authorization: "PRIOR_AUTHORIZATION",
      claim: "CLAIM",
    },
  };
}

export class ConfigurableRulesEngine implements RulesEngine {
  constructor(private readonly rules: RuleRepository) {}

  async evaluate(
    event: AdmissionEvent,
    context?: EvaluationContext
  ): Promise<Decision> {
    const asOf =
      context?.asOf ??
      (event.eventTimestamp ? new Date(event.eventTimestamp) : new Date());

    const versions = await this.rules.listActiveVersions(asOf, event.eventType);
    const sorted = [...versions].sort((a, b) => b.priority - a.priority);

    const matched: RuleVersion[] = [];
    for (const version of sorted) {
      if (evaluateCondition(event, version.conditions)) {
        matched.push(version);
      }
    }

    if (matched.length === 0) {
      return {
        decision: "NO_NOA_REQUIRED",
        notificationRequired: false,
        rulesApplied: [],
        ruleVersions: [],
        explanation: {
          requirementOutcome: "NOTIFICATION_NOT_REQUIRED",
          notificationTimingStatus: "NOT_REQUIRED",
          reason: "No active rules matched.",
        },
      };
    }

    const conflict = detectDecisionConflict(matched);
    if (conflict.conflict) {
      return {
        decision: "REJECT",
        notificationRequired: false,
        rulesApplied: matched.map((m) => m.name),
        ruleVersions: matched.map((m) => `${m.name}@${m.version}`),
        explanation: buildExplanation(
          { decision: "REJECT" },
          matched,
          event,
          asOf,
          conflict
        ),
      };
    }

    const merged = mergeActions(
      matched.map((m) => ({ priority: m.priority, actions: m.actions }))
    );

    const outcome =
      asDecisionOutcome(merged.decision) ?? "NO_NOA_REQUIRED";

    return {
      decision: outcome,
      notificationRequired:
        typeof merged.notificationRequired === "boolean"
          ? merged.notificationRequired
          : outcome === "SEND_NOA",
      notificationType:
        typeof merged.notificationType === "string"
          ? merged.notificationType
          : undefined,
      priority:
        typeof merged.priority === "string" ? merged.priority : undefined,
      rulesApplied: matched.map((m) => m.name),
      ruleVersions: matched.map((m) => `${m.name}@${m.version}`),
      explanation: buildExplanation(merged, matched, event, asOf, conflict),
    };
  }
}
