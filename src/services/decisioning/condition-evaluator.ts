import type {
  RuleCondition,
  RuleConditionGroup,
  RuleConditionLeaf,
  RuleOperator,
} from "@/src/domain/rules/rule";
import { getByPath } from "@/src/utils/path-get";

function isLeaf(condition: RuleCondition): condition is RuleConditionLeaf {
  return "path" in condition && "op" in condition;
}

function isGroup(condition: RuleCondition): condition is RuleConditionGroup {
  return "all" in condition || "any" in condition || "not" in condition;
}

function compareOrdered(left: unknown, right: unknown): number | null {
  if (typeof left === "number" && typeof right === "number") {
    return left - right;
  }
  if (typeof left === "string" && typeof right === "string") {
    const leftTime = Date.parse(left);
    const rightTime = Date.parse(right);
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
      return leftTime - rightTime;
    }
    return left.localeCompare(right);
  }
  return null;
}

function evaluateLeaf(subject: unknown, leaf: RuleConditionLeaf): boolean {
  const actual = getByPath(subject, leaf.path);
  const op: RuleOperator = leaf.op;

  switch (op) {
    case "eq":
      return actual === leaf.value;
    case "neq":
      return actual !== leaf.value;
    case "in":
      return Array.isArray(leaf.value) && leaf.value.includes(actual);
    case "notIn":
      return Array.isArray(leaf.value) && !leaf.value.includes(actual);
    case "exists":
      return actual !== undefined && actual !== null && actual !== "";
    case "gt":
    case "gte":
    case "lt":
    case "lte": {
      const cmp = compareOrdered(actual, leaf.value);
      if (cmp === null) return false;
      if (op === "gt") return cmp > 0;
      if (op === "gte") return cmp >= 0;
      if (op === "lt") return cmp < 0;
      return cmp <= 0;
    }
    default:
      return false;
  }
}

export function evaluateCondition(
  subject: unknown,
  condition: RuleCondition
): boolean {
  if (isLeaf(condition)) {
    return evaluateLeaf(subject, condition);
  }
  if (!isGroup(condition)) {
    return false;
  }
  if (condition.not) {
    return !evaluateCondition(subject, condition.not);
  }
  if (condition.all) {
    return condition.all.every((c) => evaluateCondition(subject, c));
  }
  if (condition.any) {
    return condition.any.some((c) => evaluateCondition(subject, c));
  }
  return false;
}
