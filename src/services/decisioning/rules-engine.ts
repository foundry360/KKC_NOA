import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision } from "@/src/domain/decisions/decision";
import type { DecisionOutcome } from "@/src/domain/types";
import type { RuleActions, RuleVersion } from "@/src/domain/rules/rule";
import type {
  RulesEngine,
  RuleRepository,
} from "@/src/domain/ports";
import type { EvaluationContext } from "@/src/domain/routing/routing";
import { evaluateCondition } from "./condition-evaluator";

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
    };
  }
}
