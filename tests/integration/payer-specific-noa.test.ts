import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { createTestPipeline } from "../helpers/test-pipeline";
import { FixedClock } from "@/src/utils/clock";
import { MemoryLogger } from "@/src/utils/logger";
import { createSeedRuleVersions } from "@/src/infrastructure/seed/rules";
import { ConfigurableRulesEngine } from "@/src/services/decisioning/rules-engine";
import { InMemoryRuleRepository } from "@/src/infrastructure/memory";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import {
  evaluateNotificationTiming,
  addBusinessDays,
} from "@/src/services/decisioning/notification-timing";
import {
  scoreContractMatch,
  selectMostSpecificContracts,
} from "@/src/services/routing/contract-specificity";
import { SEED_CONTRACTS } from "@/src/infrastructure/seed/contracts";
import type { RuleVersion } from "@/src/domain/rules/rule";

function loadCanonical(): Record<string, unknown> {
  return JSON.parse(
    readFileSync(
      path.join(
        process.cwd(),
        "fhir/fixtures/admission-meridian-canonical-inpatient.json"
      ),
      "utf8"
    )
  );
}

function withCoverage(
  bundle: Record<string, unknown>,
  payer: { name: string; payerType: string; plan: string }
): Record<string, unknown> {
  const clone = structuredClone(bundle) as {
    entry: Array<{ resource: Record<string, unknown> }>;
  };
  for (const e of clone.entry) {
    const r = e.resource;
    if (r.resourceType === "Organization" && r.id === "payer-001") {
      r.name = payer.name;
      const ids = Array.isArray(r.identifier) ? r.identifier : [];
      for (const id of ids) {
        if (
          id &&
          typeof id === "object" &&
          (id as { system?: string }).system?.includes("payer-type")
        ) {
          (id as { value: string }).value = payer.payerType;
        }
      }
    }
    if (r.resourceType === "Coverage") {
      const classes = Array.isArray(r.class) ? r.class : [];
      for (const c of classes) {
        if (!c || typeof c !== "object") continue;
        const type = (c as { type?: { coding?: Array<{ code?: string }> } }).type;
        const code = type?.coding?.[0]?.code;
        if (code === "plan") {
          (c as { value: string; name: string }).value = payer.plan;
          (c as { value: string; name: string }).name = payer.plan;
        }
      }
    }
  }
  return clone;
}

const CLINICAL = {
  patient: "SYNTHETIC PATIENT",
  facility: "Meridian Jacksonville Medical Center",
  diagnosis: "Pneumonia",
};

describe("Same FHIR / different coverage — payer-specific path", () => {
  const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));

  const cases = [
    {
      label: "Aetna",
      payer: {
        name: "Aetna",
        payerType: "COMMERCIAL",
        plan: "Aetna Commercial PPO",
      },
      rule: "AETNA-COMM-INPATIENT-NOTIFICATION-001",
      contract: "AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
      transform: "AETNA_ADMISSION_NOTIFICATION_V1",
      windowUnit: "BUSINESS_DAYS",
      windowValue: 2,
      auth: "NOT_REQUIRED_FOR_EMERGENCY_SERVICES",
      payloadMarker: "AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
    },
    {
      label: "Cigna",
      payer: {
        name: "Cigna",
        payerType: "COMMERCIAL",
        plan: "Cigna Commercial Open Access",
      },
      rule: "CIGNA-COMM-INPATIENT-NOTIFICATION-001",
      contract: "CIGNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
      transform: "CIGNA_ADMISSION_NOTIFICATION_V1",
      windowUnit: "BUSINESS_DAYS",
      windowValue: 1,
      auth: "NOT_REQUIRED_FOR_EMERGENCY_SERVICES",
      payloadMarker: "CIGNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
      channel: "PROVIDER_SERVICES_PHONE",
    },
    {
      label: "BCBS Arizona",
      payer: {
        name: "Blue Cross Blue Shield of Arizona",
        payerType: "COMMERCIAL",
        plan: "AZ Blue Commercial Group",
      },
      rule: "BCBSAZ-COMM-INPATIENT-NOTIFICATION-001",
      contract: "BCBSAZ_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
      transform: "BCBSAZ_ADMISSION_NOTIFICATION_V1",
      windowUnit: "HOURS",
      windowValue: 48,
      auth: "CODE_DEPENDENT",
      payloadMarker: "BCBSAZ_COMMERCIAL_INPATIENT_NOTIFICATION_V1",
    },
  ] as const;

  it("produces distinct rule → decision → contract → transform paths", async () => {
    const results = [];
    for (const c of cases) {
      const { pipeline, audit, admissions, selections } = createTestPipeline(
        clock,
        new MemoryLogger()
      );
      const body = withCoverage(loadCanonical(), c.payer);
      const result = await pipeline.process({
        rawBody: body,
        contentType: "application/fhir+json",
        correlationId: `NOA-GOLDEN-${c.label.replace(/\s+/g, "").toUpperCase()}`,
      });
      const admission = await admissions.findByEventId(result.eventId);
      const selection = await selections.findByEventId(result.eventId);
      results.push({ c, result, audit, admission, selection });
    }

    // Same clinical admission context
    for (const { result, admission } of results) {
      expect(admission?.facility.name).toBe(CLINICAL.facility);
      expect(admission?.encounter.class).toBe("INPATIENT");
      expect(admission?.patient.name.family).toBe("PATIENT");
      expect(result.decision?.decision).toBe("SEND_NOA");
      expect(result.processingState).toBe("ACKNOWLEDGED");
    }

    // Distinct payer-specific configuration (not merely payer name)
    const contracts = results.map((r) => r.result.routing?.contractBusinessId);
    const transforms = results.map((r) => r.result.routing?.transformerCode);
    const rules = results.map((r) => r.result.decision?.rulesApplied[0]);
    expect(new Set(contracts).size).toBe(3);
    expect(new Set(transforms).size).toBe(3);
    expect(new Set(rules).size).toBe(3);

    for (const { c, result, audit, admission, selection } of results) {
      expect(admission?.payer.name).toBe(c.payer.name);
      expect(result.decision?.rulesApplied).toContain(c.rule);
      expect(result.decision?.ruleVersions.some((v) => v.startsWith(`${c.rule}@`))).toBe(
        true
      );
      expect(result.decision?.explanation?.requirementOutcome).toBe(
        "NOTIFICATION_REQUIRED"
      );
      expect(result.decision?.explanation?.authorizationRequirement).toBe(c.auth);
      expect(result.decision?.explanation?.notificationWindow).toMatchObject({
        value: c.windowValue,
        unit: c.windowUnit,
      });
      expect(result.decision?.explanation?.sources?.[0]?.sourceUrl).toBeTruthy();
      expect(result.decision?.explanation?.sources?.[0]?.sourceUrl).not.toBe(
        "UNKNOWN"
      );
      expect(result.routing?.contractBusinessId).toBe(c.contract);
      expect(selection?.routing.contractVersion.version).toBe(1);
      expect(result.routing?.transformerCode).toBe(c.transform);
      expect(result.transformation?.payload).toMatchObject({
        transformKind: "SYNTHETIC_DEMO_TRANSFORM",
        transactionKind: "ADMISSION_NOTIFICATION",
        payerProfile: c.payloadMarker,
        payerName: c.payer.name,
      });
      if ("channel" in c && c.channel) {
        expect(result.transformation?.payload).toMatchObject({
          submissionChannel: c.channel,
          onlinePrecertToolAllowedForInpatientNotification: false,
        });
      }

      const trail = await audit.listByCorrelationId(result.correlationId);
      expect(trail.map((e) => e.action)).toContain("RULES_EVALUATED");
      expect(trail.map((e) => e.action)).toContain("CONTRACT_SELECTED");
      expect(trail.map((e) => e.action)).toContain("ACKNOWLEDGEMENT_RECEIVED");
    }
  });
});

describe("Notification timing", () => {
  it("marks DUE vs OVERDUE for authoritative windows", () => {
    const admit = "2026-09-09T14:30:00.000Z";
    expect(
      evaluateNotificationTiming(
        { value: 48, unit: "HOURS", startEvent: "ADMISSION_TIME" },
        admit,
        new Date("2026-09-10T14:00:00.000Z")
      )
    ).toBe("DUE");
    expect(
      evaluateNotificationTiming(
        { value: 48, unit: "HOURS", startEvent: "ADMISSION_TIME" },
        admit,
        new Date("2026-09-12T14:30:00.000Z")
      )
    ).toBe("OVERDUE");
    expect(
      evaluateNotificationTiming("UNKNOWN", admit, new Date())
    ).toBe("UNKNOWN");
  });

  it("counts business days for Aetna/Cigna windows", () => {
    const friday = new Date("2026-09-11T14:30:00.000Z"); // Friday
    const plusOneBiz = addBusinessDays(friday, 1);
    expect(plusOneBiz.toISOString().slice(0, 10)).toBe("2026-09-14"); // Monday
  });
});

describe("Contract specificity + conflicts", () => {
  it("scores brand profiles above generic commercial", () => {
    const asOf = new Date("2026-09-09T18:00:00.000Z");
    const aetna = SEED_CONTRACTS.find(
      (c) => c.contractBusinessId === "AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1"
    )!;
    const generic = SEED_CONTRACTS.find(
      (c) => c.contractBusinessId === "COMMERCIAL_NOA_MOCK_V1"
    )!;
    const input = {
      payerType: "COMMERCIAL",
      payer: "Aetna",
      asOf,
    };
    expect(scoreContractMatch(aetna, input)!).toBeGreaterThan(
      scoreContractMatch(generic, input)!
    );
    const { selected } = selectMostSpecificContracts([aetna, generic], input);
    expect(selected[0]?.contractBusinessId).toBe(
      "AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1"
    );
  });

  it("flags same-specificity contract conflicts", () => {
    const asOf = new Date("2026-09-09T18:00:00.000Z");
    const a = {
      ...SEED_CONTRACTS.find(
        (c) => c.contractBusinessId === "AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1"
      )!,
      contractBusinessId: "AETNA_A",
    };
    const b = {
      ...a,
      id: "44444444-4444-4444-8444-444444444099",
      contractBusinessId: "AETNA_B",
    };
    const { conflict } = selectMostSpecificContracts([a, b], {
      payerType: "COMMERCIAL",
      payer: "Aetna",
      asOf,
    });
    expect(conflict).toBe(true);
  });
});

describe("Rule conflict handling", () => {
  it("rejects when two same-priority rules disagree on decision", async () => {
    const rules = new InMemoryRuleRepository();
    const conflicting: RuleVersion[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa01",
        ruleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa11",
        name: "CONFLICT_SEND",
        version: 1,
        priority: 300,
        effectiveDate: "2020-01-01T00:00:00.000Z",
        conditions: { path: "eventType", op: "eq", value: "ADMISSION" },
        actions: { decision: "SEND_NOA", notificationRequired: true },
      },
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa02",
        ruleId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa12",
        name: "CONFLICT_NO",
        version: 1,
        priority: 300,
        effectiveDate: "2020-01-01T00:00:00.000Z",
        conditions: { path: "eventType", op: "eq", value: "ADMISSION" },
        actions: { decision: "NO_NOA_REQUIRED", notificationRequired: false },
      },
    ];
    rules.seed([...createSeedRuleVersions(), ...conflicting]);
    const engine = new ConfigurableRulesEngine(rules);
    const event: AdmissionEvent = {
      eventId: "00000000-0000-4000-8000-000000000099",
      correlationId: "NOA-CONFLICT",
      sourceSystem: "TEST",
      eventType: "ADMISSION",
      eventTimestamp: "2026-09-09T14:30:00.000Z",
      patient: { name: { family: "X" } },
      encounter: { class: "INPATIENT" },
      admission: { admissionDateTime: "2026-09-09T14:30:00.000Z" },
      facility: {},
      payer: { name: "Aetna", payerType: "COMMERCIAL" },
      coverage: {},
      diagnoses: [],
      providers: [],
      sourceMetadata: {},
    };
    const decision = await engine.evaluate(event);
    expect(decision.decision).toBe("REJECT");
    expect(decision.explanation?.conflict).toBe(true);
    expect(decision.explanation?.conflictRuleIds).toEqual(
      expect.arrayContaining(["CONFLICT_SEND", "CONFLICT_NO"])
    );
  });
});

describe("Notification vs authorization distinction", () => {
  it("keeps authorization requirement separate from notification decision", async () => {
    const rules = new InMemoryRuleRepository();
    rules.seed(createSeedRuleVersions());
    const engine = new ConfigurableRulesEngine(rules);
    const event: AdmissionEvent = {
      eventId: "00000000-0000-4000-8000-000000000098",
      correlationId: "NOA-AUTH-DIST",
      sourceSystem: "TEST",
      eventType: "ADMISSION",
      eventTimestamp: "2026-09-09T14:30:00.000Z",
      patient: { name: { family: "X" } },
      encounter: { class: "INPATIENT" },
      admission: { admissionDateTime: "2026-09-09T14:30:00.000Z" },
      facility: { address: { state: "AZ" } },
      payer: {
        name: "Blue Cross Blue Shield of Arizona",
        payerType: "COMMERCIAL",
      },
      coverage: {},
      diagnoses: [],
      providers: [],
      sourceMetadata: {},
    };
    const decision = await engine.evaluate(event);
    expect(decision.decision).toBe("SEND_NOA");
    expect(decision.explanation?.requirementOutcome).toBe("NOTIFICATION_REQUIRED");
    expect(decision.explanation?.authorizationRequirement).toBe("CODE_DEPENDENT");
    expect(decision.explanation?.transactionKinds?.notification).toBe(
      "ADMISSION_NOTIFICATION"
    );
    expect(decision.explanation?.transactionKinds?.authorization).toBe(
      "PRIOR_AUTHORIZATION"
    );
    expect(decision.explanation?.transactionKinds?.claim).toBe("CLAIM");
  });
});

describe("Source traceability", () => {
  it("persists published source URL on payer-brand rule actions", () => {
    const aetna = createSeedRuleVersions().find(
      (r) => r.name === "AETNA-COMM-INPATIENT-NOTIFICATION-001"
    );
    const provenance = aetna?.actions.provenance as { sourceUrl?: string };
    expect(provenance?.sourceUrl).toContain("aetna.com");
  });
});
