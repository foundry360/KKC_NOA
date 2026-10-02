import type { RuleVersion } from "@/src/domain/rules/rule";
import { findRequirements } from "@/src/infrastructure/seed/payer-requirements";

function provenanceFrom(requirementId: string) {
  const req = findRequirements({}).find((r) => r.id === requirementId);
  if (!req) {
    return {
      sourceType: "PUBLISHED_PAYER_REQUIREMENT",
      source: "UNKNOWN",
      sourceUrl: "UNKNOWN",
      verificationDate: "2026-09-10",
      evidence: "UNKNOWN",
      version: "1.0",
    };
  }
  return {
    ...req.evidence,
    requirementId: req.id,
  };
}

/**
 * Seed rules: payer-brand specifics (higher priority) + facility fallback.
 * Rules decide WHAT (notification/authorization). Contracts decide HOW.
 */
export function createSeedRuleVersions(): RuleVersion[] {
  return [
    {
      id: "11111111-1111-4111-8111-111111111201",
      ruleId: "11111111-1111-4111-8111-111111111011",
      name: "AETNA-COMM-INPATIENT-NOTIFICATION-001",
      version: 1,
      priority: 200,
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
          { path: "payer.payerType", op: "eq", value: "COMMERCIAL" },
          { path: "payer.name", op: "eq", value: "Aetna" },
        ],
      },
      actions: {
        decision: "SEND_NOA",
        notificationRequired: true,
        notificationType: "ADMISSION_NOTIFICATION",
        priority: "HIGH",
        requirementOutcome: "NOTIFICATION_REQUIRED",
        authorizationRequirement: "NOT_REQUIRED_FOR_EMERGENCY_SERVICES",
        notificationWindow: {
          value: 2,
          unit: "BUSINESS_DAYS",
          startEvent: "EMERGENCY_ADMISSION_TIME",
        },
        reason:
          "Aetna published requirement: emergency visit resulting in inpatient admission must be reported within two business days. Inpatient confinements separately appear on the precertification list; notification ≠ coverage determination.",
        provenance: provenanceFrom("AETNA-COMM-INPATIENT-NOTIFICATION-001"),
      },
    },
    {
      id: "11111111-1111-4111-8111-111111111202",
      ruleId: "11111111-1111-4111-8111-111111111012",
      name: "CIGNA-COMM-INPATIENT-NOTIFICATION-001",
      version: 1,
      priority: 200,
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
          { path: "payer.payerType", op: "eq", value: "COMMERCIAL" },
          { path: "payer.name", op: "eq", value: "Cigna" },
        ],
      },
      actions: {
        decision: "SEND_NOA",
        notificationRequired: true,
        notificationType: "ADMISSION_NOTIFICATION",
        priority: "HIGH",
        requirementOutcome: "NOTIFICATION_REQUIRED",
        authorizationRequirement: "NOT_REQUIRED_FOR_EMERGENCY_SERVICES",
        notificationWindow: {
          value: 1,
          unit: "BUSINESS_DAYS",
          startEvent: "EMERGENCY_ADMISSION_TIME",
        },
        reason:
          "Cigna published requirement: emergency services resulting in inpatient admission must be reported within one business day (unless state mandate differs). Precertification is not required for emergency services; elective precert is separate.",
        provenance: provenanceFrom("CIGNA-COMM-EMERGENCY-IP-REPORT-001"),
      },
    },
    {
      id: "11111111-1111-4111-8111-111111111203",
      ruleId: "11111111-1111-4111-8111-111111111013",
      name: "BCBSAZ-COMM-INPATIENT-NOTIFICATION-001",
      version: 1,
      priority: 200,
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
          { path: "payer.payerType", op: "eq", value: "COMMERCIAL" },
          {
            path: "payer.name",
            op: "in",
            value: [
              "Blue Cross Blue Shield of Arizona",
              "BCBS Arizona",
              "AZ Blue",
            ],
          },
        ],
      },
      actions: {
        decision: "SEND_NOA",
        notificationRequired: true,
        notificationType: "ADMISSION_NOTIFICATION",
        priority: "HIGH",
        requirementOutcome: "NOTIFICATION_REQUIRED",
        authorizationRequirement: "CODE_DEPENDENT",
        notificationWindow: {
          value: 48,
          unit: "HOURS",
          startEvent: "ADMISSION_TIME",
        },
        reason:
          "AZ Blue commercial published requirement: post-admission notification always required within 48 hours. Prior authorization is code/plan dependent and is a separate transaction from notification.",
        provenance: provenanceFrom("BCBSAZ-COMM-POST-ADMISSION-NOTIFICATION-001"),
      },
    },
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
        requirementOutcome: "NOTIFICATION_REQUIRED",
        authorizationRequirement: "UNKNOWN",
        notificationWindow: "UNKNOWN",
        reason:
          "Facility admission fallback: inpatient/emergency/observation admissions require notification under the generic facility rule when no payer-brand rule is more specific.",
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
        requirementOutcome: "NOTIFICATION_NOT_REQUIRED",
        authorizationRequirement: "UNKNOWN",
        notificationWindow: "UNKNOWN",
        reason: "Outpatient encounters are out of scope for facility NOA in this POC.",
      },
    },
  ];
}
