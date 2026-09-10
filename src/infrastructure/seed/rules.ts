import type { RuleVersion } from "@/src/domain/rules/rule";

/**
 * Seed rules for facility admissions from any payer.
 * Outpatient remains explicitly out of scope for NOA.
 */
export function createSeedRuleVersions(): RuleVersion[] {
  return [
    {
      id: "11111111-1111-4111-8111-111111111101",
      ruleId: "11111111-1111-4111-8111-111111111001",
      name: "FACILITY_ADMISSION_NOA",
      version: 1,
      priority: 100,
      effectiveDate: "2020-01-01T00:00:00.000Z",
      expirationDate: null,
      conditions: {
        all: [
          { path: "eventType", op: "eq", value: "ADMISSION" },
          {
            path: "encounter.class",
            op: "in",
            value: ["INPATIENT", "EMERGENCY", "OBSERVATION"],
          },
        ],
      },
      actions: {
        decision: "SEND_NOA",
        notificationRequired: true,
        notificationType: "NOA",
        priority: "HIGH",
      },
    },
    {
      id: "11111111-1111-4111-8111-111111111102",
      ruleId: "11111111-1111-4111-8111-111111111002",
      name: "OUTPATIENT_NO_NOA",
      version: 1,
      priority: 90,
      effectiveDate: "2020-01-01T00:00:00.000Z",
      expirationDate: null,
      conditions: {
        all: [
          { path: "eventType", op: "eq", value: "ADMISSION" },
          { path: "encounter.class", op: "eq", value: "OUTPATIENT" },
        ],
      },
      actions: {
        decision: "NO_NOA_REQUIRED",
        notificationRequired: false,
        notificationType: "NOA",
        priority: "LOW",
      },
    },
  ];
}
