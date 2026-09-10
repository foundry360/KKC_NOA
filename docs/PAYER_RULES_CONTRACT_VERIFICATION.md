# Payer Rules & Contract Orchestration — Verification Report

**Date:** 2026-09-09  
**Scope:** Read-only inspection of the NOA/FHIR POC implementation  
**Standard:** Evidence from code, schema, seeds, runtime path, and tests — not documentation intent  

**No application code, schema, seeds, UI, or tests were modified for this report.**

---

## Executive Summary

**Overall status: PARTIALLY IMPLEMENTED**

The POC has a real, configurable rules engine and a real contract registry that participate in the live pipeline:

```text
FHIR → validate → normalize → rules → decision → contract → transform → deliver → ack → audit
```

It does **not** yet demonstrate the core differentiator at brand/plan level:

> Same FHIR admission → different payer/plan/provider context → different rules → different decision → different contract/action.

What works today:

- Same FHIR admission class → same **decision** for every commercial brand (Aetna, Cigna, BCBS, etc.).
- Different **payer type** (`MEDICARE` | `COMMERCIAL` | `MEDICAID`) → different **contract row** (and for Medicare, optional SF/Pega mock destinations).
- Commercial and Medicaid contracts reuse the **same** mock transform as Medicare mock.
- SF/Pega adapters wrap the mock delivery adapter (no live payer).

**Bottom line:** Rules vs contracts are architecturally separated and wired. Payer-**type** orchestration is real. Payer-**brand** / plan / provider differentiation is not implemented in seeded rules or contracts.

---

## Capability Matrix

| Capability | Status | Evidence |
| ---------- | ------ | -------- |
| Payer-specific rules | PARTIAL | Engine can evaluate `payer.payerType` / `payer.name`; **seeded rules ignore payer**. Live rule `FACILITY_ADMISSION_NOA` matches encounter class only (`src/infrastructure/seed/rules.ts`). |
| Plan-specific rules | NOT IMPLEMENTED | `coverage.plan` exists on `AdmissionEvent`; no seeded rule uses it. |
| Provider/facility variation | NOT IMPLEMENTED | `facility.*`, `providers[]` on model; unused by seeds / `findMatching`. |
| Rule versioning | IMPLEMENTED | `RuleVersion.version`, `effectiveDate`, `expirationDate`; DB `rules` + `rule_versions`. |
| Persisted rule execution | PARTIAL | `rule_executions` + in-memory repo; snapshot includes payerType/class. Supabase `matched_rule_version_ids` often empty because engine stores `Name@ver` strings, not UUIDs. Match info remains in `result_summary` / decision `ruleVersions`. |
| Decision persistence | IMPLEMENTED | `decisions` table / `DecisionRecord` with `decision`, `rulesApplied`, `ruleVersions`, `payload`. |
| Contract registry | IMPLEMENTED | DB + TS: `contracts`, `contract_versions`, `destinations`, `transformations`; `DefaultContractRegistry` used by `RoutingService`. |
| Contract versioning | IMPLEMENTED | `ContractVersionRecord.version`, effective/expiration dates. |
| Contract-specific fields | PARTIAL | `requiredFields`, format, transport, destination, transformer, retry, ack type on version. Schema has `contract_fields` table; **not used** by TypeScript registry. Selection input supports `payer`/`state`/`encounterClass` but **matching ignores** brand/state/class. |
| Contract-specific transformation | PARTIAL | Distinct transforms for Mock vs SF vs Pega **destination shape**. Commercial/Medicaid reuse `MEDICARE_NOA_MOCK_TRANSFORM` — not brand-specific payloads. |
| Dynamic routing | IMPLEMENTED | After `SEND_NOA`, registry resolves destination + adapter + transformer; override via `X-Contract-Id` / `contractBusinessId`. |
| Transaction outcomes | PARTIAL | Processing states + delivery ack (`ACKNOWLEDGED`, failures, `NO_CONTRACT`, `NO_NOA_REQUIRED`). Notification ack only. |
| Authorization separation | IMPLEMENTED (as absence) | No prior-auth / claim domain; ack is delivery acknowledgement, not auth decision. UI “Payer Response” = mock ack summary. |
| Audit trail | IMPLEMENTED | `AuditPort` actions: EVENT_RECEIVED → … → ACKNOWLEDGEMENT_RECEIVED (see e2e golden path). |
| Decision explanation | PARTIAL | NOA Admin `/events/[id]` shows decision, rules applied, rule versions, selected contract. No free-text reason. Meridian notification UI shows decision/adapter/ack, not rule/contract detail. |

---

## Architecture Verified in Code

### Pipeline (real)

| Stage | Implementation |
| ----- | -------------- |
| Ingest | `app/api/fhir/r4/events/route.ts` |
| Validate | `src/services/fhir/validator.ts` |
| Normalize | `src/services/normalization/normalize-admission.ts` → `AdmissionEvent` |
| Rules | `ConfigurableRulesEngine` + `DecisioningService` |
| Route | `RoutingService` + `DefaultContractRegistry` |
| Transform | `TransformationService` + `SimpleMappingTransformationEngine` |
| Deliver | `DefaultDeliveryService` + adapter registry |
| Orchestrate | `DefaultNoaPipeline` |

### Intended flow vs actual

```text
FHIR Admission Event          ← edge input (preserved)
        ↓
Canonical Admission Event     ← IMPLEMENTED
        ↓
Payer / Plan Context          ← PARTIAL (payerType + name/plan on model; brand unused by rules)
        ↓
Rules                         ← IMPLEMENTED engine; PARTIAL content (class-based only)
        ↓
Decision                      ← IMPLEMENTED (SEND_NOA | NO_NOA_REQUIRED | …)
        ↓
Contract                      ← IMPLEMENTED by payer TYPE
        ↓
Transformation                ← PARTIAL (adapter-shaped; not brand-shaped)
        ↓
Delivery                      ← IMPLEMENTED (mock / SF-stub / Pega-stub)
```

**FHIR does not need to change for type-level contract differences** — changing Coverage payor type identifier (MEDICARE ↔ COMMERCIAL ↔ MEDICAID) on an otherwise equivalent Bundle changes contract selection. Brand-only changes (Aetna → Cigna) do **not** change decision or contract with current seeds.

---

## 1. Rules Engine Verification

### A. Are rules externalized?

**Yes (data-driven).** Runtime loads rule versions from:

- Supabase `rule_versions` (+ `rules`) when `SUPABASE_URL` + service role are set (`ensureSupabaseConfigSeed` upserts from TS seed), or
- In-memory seed from `src/infrastructure/seed/rules.ts`

Changing behavior for new conditions can be done by updating seed/DB JSON **without** changing engine code, provided the needed paths already exist on `AdmissionEvent`.

### B. What attributes can rules evaluate?

**Any dot-path** on the evaluation subject (`AdmissionEvent`) via `getByPath`, with operators: `eq`, `neq`, `in`, `notIn`, `exists`, `gt`, `gte`, `lt`, `lte`, plus `all` / `any` / `not`.

Fields present on the model that *could* be used:

| Attribute | On AdmissionEvent? | Used by seeded rules? |
| --------- | ------------------ | --------------------- |
| payer.payerType | Yes | No |
| payer.name | Yes | No |
| coverage.plan | Yes | No |
| coverage.subscriberId | Yes | No |
| encounter.class | Yes | **Yes** |
| admission.admissionType | Yes | No |
| facility.* | Yes | No |
| providers[] | Yes | No |
| diagnoses | Yes | No |
| network status | **No field** | N/A |
| authorization requirements | **No field** | N/A |
| submission timing windows | Only via date ops on timestamps if authored | No |

### C. Are rules versioned?

**Yes.** `RuleVersion`: `id`, `ruleId`, `name`, `version`, `priority`, `effectiveDate`, `expirationDate`, `conditions`, `actions`. Header `rules.active` / `priority`.

### D. Is the rule result persisted?

**Yes (with caveat).**

Persisted:

- `decisions` — outcome, notification flags, `rulesApplied`, `ruleVersions`, full payload
- `rule_executions` — timing, `inputSnapshot` (`eventType`, `encounterClass`, `payerType`), `resultSummary`

Caveat: engine `ruleVersions` are strings like `FACILITY_ADMISSION_NOA@1`; Supabase UUID array column may not store them as IDs.

### Seeded rules (actual)

1. **`FACILITY_ADMISSION_NOA`** — ADMISSION + class ∈ {INPATIENT, EMERGENCY, OBSERVATION} → `SEND_NOA`
2. **`OUTPATIENT_NO_NOA`** — ADMISSION + OUTPATIENT → `NO_NOA_REQUIRED`

No match → engine default `NO_NOA_REQUIRED`.

---

## 2. Contract Registry Verification

### Represented independently from rules?

**Yes.** Rules produce a `Decision`. Only if `decision === "SEND_NOA"` does `RoutingService` call the registry.

### Configurable records (not hard-coded payer ifs)

**Yes** — seeded rows in TS (`src/infrastructure/seed/contracts.ts`) and Supabase.

| Contract ID | Payer (type) | Destination | Transformer |
| ----------- | ------------ | ----------- | ----------- |
| MEDICARE_NOA_MOCK_V1 | MEDICARE | MOCK_PAYER | MEDICARE_NOA_MOCK_TRANSFORM |
| MEDICARE_NOA_SF_V1 | MEDICARE | SF_NOA_INBOX | MEDICARE_NOA_SF_TRANSFORM |
| MEDICARE_NOA_PEGA_V1 | MEDICARE | PEGA_NOA_CASE | MEDICARE_NOA_PEGA_TRANSFORM |
| COMMERCIAL_NOA_MOCK_V1 | COMMERCIAL | MOCK_PAYER | MEDICARE_NOA_MOCK_TRANSFORM *(reuse)* |
| MEDICAID_NOA_MOCK_V1 | MEDICAID | MOCK_PAYER | MEDICARE_NOA_MOCK_TRANSFORM *(reuse)* |

### Contract capabilities vs desired list

| Desired | Status |
| ------- | ------ |
| payer (type string) | IMPLEMENTED |
| plan/product | PARTIAL — `product: "NOA"` on all; not plan-specific; routing does not pass `product` filter today |
| provider/facility applicability | NOT IMPLEMENTED |
| effective date | IMPLEMENTED |
| transaction type | PARTIAL — product NOA only |
| required fields | IMPLEMENTED on version |
| output format / transport | IMPLEMENTED |
| endpoint / auth | IMPLEMENTED on destination |
| acknowledgement expectations | IMPLEMENTED field |
| retry behavior | IMPLEMENTED |
| transformation | IMPLEMENTED link via `transformerCode` |
| response/outcome behavior | PARTIAL — adapter ack; not payer business outcomes |

`findMatching` uses: active, effective dates, optional `contractBusinessId`, `payerType` vs `v.payer`, optional `product`. **Does not use** `ContractSelectionInput.payer`, `state`, or `encounterClass`.

---

## 3. Rules vs Contracts Separation

| Concern | Owner | Verdict |
| ------- | ----- | ------- |
| What should happen? | Rules → Decision | **Separated** |
| How to execute? | Contract → destination/transform/adapter | **Separated** |
| Mixed together? | No hard-coded “if Aetna then …” in pipeline | **Not mixed** |

Gap is **content richness**, not structural mixing: rules do not encode “Cigna commercial requires auth”; contracts do not encode Cigna-specific endpoints.

---

## 4. Payer Scenario Results

No FHIR fixtures named Aetna / BCBS AZ / Cigna. Meridian has commercial brands (Aetna, Cigna, Blue Cross Blue Shield — not “BCBS AZ”). Scenarios below assume **same inpatient ADMISSION Bundle**, varying only Coverage payor type/name as Meridian would emit.

| Scenario | Rules matched | Decision | Contract | Transformation | Delivery | Outcome |
| -------- | ------------- | -------- | -------- | -------------- | -------- | ------- |
| Aetna (COMMERCIAL inpatient) | FACILITY_ADMISSION_NOA | SEND_NOA | COMMERCIAL_NOA_MOCK_V1 | MEDICARE_NOA_MOCK_TRANSFORM | mock | ACK-MOCK-* |
| BCBS (COMMERCIAL inpatient; Meridian “Blue Cross Blue Shield”) | FACILITY_ADMISSION_NOA | SEND_NOA | COMMERCIAL_NOA_MOCK_V1 | MEDICARE_NOA_MOCK_TRANSFORM | mock | ACK-MOCK-* |
| Cigna (COMMERCIAL inpatient) | FACILITY_ADMISSION_NOA | SEND_NOA | COMMERCIAL_NOA_MOCK_V1 | MEDICARE_NOA_MOCK_TRANSFORM | mock | ACK-MOCK-* |
| Medicare inpatient (contrast) | FACILITY_ADMISSION_NOA | SEND_NOA | MEDICARE_NOA_MOCK_V1 *(default among 3)* | MEDICARE_NOA_MOCK_TRANSFORM | mock | ACK-MOCK-* |
| Outpatient (any payer) | OUTPATIENT_NO_NOA | NO_NOA_REQUIRED | *(none)* | *(none)* | *(none)* | EVALUATED |

**Aetna vs BCBS vs Cigna: identical rule/decision/contract/transform/delivery path.**

Evidence: Meridian integration test admits commercial Maria Garcia (Aetna) → `COMMERCIAL_NOA_MOCK_V1` + same mock transform (`tests/integration/meridian-admit.test.ts`).

---

## 5. Same FHIR Event?

**Type-level:** Yes — keep Bundle structure; change payer type identifier → different contract. Decision still identical for facility classes.

**Brand-level:** No — Aetna/Cigna/BCBS all COMMERCIAL → same path. FHIR brand name alone does not drive different rules/actions with current config.

---

## 6. Decision Explanation (UI)

| Surface | Shows | Backed by persistence? |
| ------- | ----- | ---------------------- |
| NOA Admin `/events/[id]` | Decision, rules applied, rule versions, contractBusinessId, destination, adapter, transformer | Yes (`decisions`, routing selections, audit) |
| NOA Admin `/rules`, `/contracts` | Config listing | Yes (config tables / seed) |
| Meridian notification | Timeline, decision string, adapter, ack | Meridian session store + NOA result; incomplete vs admin |

No dedicated “reason/explanation” string beyond matched rule names and decision code.

---

## 7. Transaction Outcome vs Authorization

| Concept | In POC? |
| ------- | ------- |
| Notification submitted / ACKNOWLEDGED / failed / NO_NOA_REQUIRED / NO_CONTRACT | Yes |
| Prior authorization requested/approved/denied | **No** |
| Claim submitted/adjudicated/paid | **No** |

UI “Payer Acknowledgement Summary” / “Payer Response” refers to **delivery acknowledgement** (`ACK-MOCK-*`), not authorization or adjudication. That separation is correct for a NOA POC, but labeling can be misread as auth.

---

## 8. Contract-Specific Transformation

**Adapter-shape differentiation: IMPLEMENTED** (Mock JSON vs SF field names vs Pega field names) via contract override `MEDICARE_NOA_SF_V1` / `MEDICARE_NOA_PEGA_V1` (tested in e2e/contracts suites).

**Payer-brand payload differentiation: NOT IMPLEMENTED.**

> Contract-specific transformation by commercial payer brand is architected (registry → transformerCode) but not seeded: Commercial/Medicaid point at Medicare mock mappings.

---

## 9. Routing

Dynamic after decision: registry → destination `adapterKey` → delivery adapter. Override via `contractBusinessId`. No hard-coded Aetna/Cigna branches in routing code. Hard-coding risk is only in **seed defaults** (Medicare mock preferred when multiple Medicare contracts match).

---

## 10. Provider / Facility Variation

**Model:** supports facility and providers on `AdmissionEvent`.  
**Registry matching:** does not filter by them.  
**Seeds:** no provider/facility-specific contracts or rules.

Supported dimensions today: **payer type**, **product (NOA, unused in match call)**, **effective date**, **explicit contract id**.  
Not supported in matching: **payer brand**, **plan**, **provider**, **facility**, **network**, **state**.

---

## 11. Test Suite Results

| Metric | Value |
| ------ | ----- |
| Test files | 18 passed |
| Tests | **55 passed**, 0 failed, 0 skipped |

Relevant coverage that exists:

- Medicare inpatient golden path → ACKNOWLEDGED + mock contract
- Outpatient → NO_NOA_REQUIRED
- Contract override → SF / Pega adapters
- Commercial Meridian admit → COMMERCIAL_NOA_MOCK_V1
- Rules engine unit tests (operators / merge)

**Missing coverage for the differentiator:**

- Same Bundle, Aetna vs Cigna vs BCBS → assert *different* rules/contracts (would fail today)
- Plan-specific or facility-specific rules
- Brand-specific transforms
- Authorization vs notification outcome separation tests

---

## Critical Finding

> **Can the POC currently demonstrate "Same FHIR. Different payer. Different rules. Different action"?**

**No — not at commercial brand / plan / provider level.**

It **can** demonstrate:

> Same FHIR structure. Different **payer type**. Same rules (for facility admits). **Different contract row** (Medicare vs Commercial vs Medicaid). Same mock transform for commercial/medicaid. Different destination **only** when Medicare SF/Pega contract is explicitly selected.

The differentiator story requires additional **seeded (or admin-authored) rules and contracts** keyed by payer brand and/or plan, plus transforms/destinations that diverge — the **engine and registry already support much of that** via path conditions and contract rows; the **content and matching dimensions** do not.

---

## Gaps

### Critical (blocks differentiator demo)

1. No brand-level rules (Aetna / Cigna / BCBS) — only encounter-class rules.
2. No brand-level contracts — only MEDICARE / COMMERCIAL / MEDICAID type buckets.
3. No tests proving same FHIR → different commercial outcomes.

### Important (weakens credibility)

4. Commercial/Medicaid reuse Medicare mock transform (payloads not payer-specific).
5. `ContractSelectionInput.payer` / `state` / `encounterClass` unused by `findMatching`.
6. Meridian UI under-explains rules/contract vs NOA Admin.
7. SF/Pega are mock wrappers — fine for POC if labeled; easy to oversell.

### Enhancement

8. Use `contract_fields` table in runtime.
9. Persist matched rule version UUIDs correctly.
10. Prior-auth / claim domains if product expands beyond NOA.
11. Network / auth-requirement attributes on canonical model.
12. Fix Meridian OBSERVATION → FHIR AMB → NOA OUTPATIENT mapping if observation should hit facility NOA rule.

---

## Recommended Next Implementation Step

**Do not rebuild the engine.** Author the differentiator in **configuration**:

1. Add rules (versioned) that branch on `payer.name` and/or a stable payer identifier / plan — e.g. Aetna vs Cigna vs BCBS — with distinct decisions or notification metadata if needed.
2. Add contracts per brand (or plan) with distinct `transformerCode` and/or destinations.
3. Extend `findMatching` to honor `payer` (brand) and optionally plan/state.
4. Add a golden test: **identical Bundle body**, only Coverage payor differs → assert different `rulesApplied` / `contractBusinessId` / transform payload.
5. Surface rule + contract on Meridian notification for the demo story.

That is the shortest path from **PARTIALLY IMPLEMENTED** to a credible demo of the differentiator.
