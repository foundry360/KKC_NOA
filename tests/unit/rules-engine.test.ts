import { describe, expect, it } from "vitest";
import { evaluateCondition } from "@/src/services/decisioning/condition-evaluator";
import { mergeActions } from "@/src/services/decisioning/rules-engine";
import { getByPath } from "@/src/utils/path-get";

describe("path-get + condition evaluator", () => {
  const subject = {
    eventType: "ADMISSION",
    encounter: { class: "INPATIENT" },
    payer: { payerType: "MEDICARE" },
  };

  it("reads nested paths", () => {
    expect(getByPath(subject, "payer.payerType")).toBe("MEDICARE");
    expect(getByPath(subject, "missing.path")).toBeUndefined();
  });

  it("evaluates all/any/not and leaf operators", () => {
    expect(
      evaluateCondition(subject, {
        all: [
          { path: "eventType", op: "eq", value: "ADMISSION" },
          { path: "encounter.class", op: "eq", value: "INPATIENT" },
        ],
      })
    ).toBe(true);

    expect(
      evaluateCondition(subject, {
        any: [
          { path: "payer.payerType", op: "eq", value: "MEDICAID" },
          { path: "payer.payerType", op: "in", value: ["MEDICARE", "COMMERCIAL"] },
        ],
      })
    ).toBe(true);

    expect(
      evaluateCondition(subject, {
        not: { path: "encounter.class", op: "eq", value: "OUTPATIENT" },
      })
    ).toBe(true);

    expect(
      evaluateCondition(subject, { path: "payer.payerType", op: "exists" })
    ).toBe(true);
  });

  it("merges actions with higher priority winning", () => {
    const merged = mergeActions([
      {
        priority: 50,
        actions: {
          decision: "NO_NOA_REQUIRED",
          notificationRequired: false,
          priority: "LOW",
        },
      },
      {
        priority: 100,
        actions: {
          decision: "SEND_NOA",
          notificationRequired: true,
          notificationType: "NOA",
          priority: "HIGH",
        },
      },
    ]);

    expect(merged.decision).toBe("SEND_NOA");
    expect(merged.priority).toBe("HIGH");
    expect(merged.notificationRequired).toBe(true);
  });
});
