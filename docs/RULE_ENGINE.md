# Rules Engine — FHIR NOA Accelerator

## Purpose

Configurable evaluation of canonical events to produce an **explicit Decision**. Rules are not hard-coded in API routes or React components.

```
AdmissionEvent → RulesEngine.evaluate() → Decision
```

## Rule Model

| Attribute | Description |
|-----------|-------------|
| `id` / `name` | Stable identity (e.g. `MEDICARE_INPATIENT_NOA`) |
| `description` | Human-readable purpose |
| `version` | Integer or semver string per `rule_versions` |
| `priority` | Higher priority evaluated / wins per conflict policy |
| `active` | Soft enable/disable |
| `effectiveDate` / `expirationDate` | Temporal applicability |
| `conditions` | Structured predicate tree (JSON) |
| `actions` | Structured outcomes when matched |

### Example Rule (Conceptual)

```
WHEN:
  eventType = ADMISSION
  AND encounterClass = INPATIENT
  AND payerType = MEDICARE
THEN:
  notificationRequired = true
  notificationType = NOA
  priority = HIGH
  decision = SEND_NOA
```

JSON-ish condition representation for POC:

```json
{
  "all": [
    { "path": "eventType", "op": "eq", "value": "ADMISSION" },
    { "path": "encounter.class", "op": "eq", "value": "INPATIENT" },
    { "path": "payer.payerType", "op": "eq", "value": "MEDICARE" }
  ]
}
```

Actions:

```json
{
  "decision": "SEND_NOA",
  "notificationRequired": true,
  "notificationType": "NOA",
  "priority": "HIGH"
}
```

## Decision Output

Always persist an explicit decision object, including when NOA is **not** required.

```json
{
  "decision": "SEND_NOA",
  "notificationType": "NOA",
  "priority": "HIGH",
  "rulesApplied": ["MEDICARE_INPATIENT_NOA"],
  "ruleVersions": ["MEDICARE_INPATIENT_NOA@1"]
}
```

Other outcomes:

| Decision | Meaning | Typical next state |
|----------|---------|-------------------|
| `SEND_NOA` | Proceed to routing | `EVALUATED` → `ROUTED` |
| `NO_NOA_REQUIRED` | Valid event; no notification | Terminal success-like / `RULE_REJECTED` or dedicated completed-without-send — **POC:** state `RULE_REJECTED` or keep `EVALUATED` with decision recorded; prefer distinct UI label from failures |
| `REJECT` | Business rejection | `RULE_REJECTED` |

**POC clarification:** Use processing state `RULE_REJECTED` for reject path; for `NO_NOA_REQUIRED`, use state `EVALUATED` with decision `NO_NOA_REQUIRED` and do not route/deliver. Document in audit as “NOA not required.”

## Evaluation Algorithm (POC)

1. Load active rule versions effective at `eventTimestamp` (or `now` if unspecified).
2. Filter by `eventType` when declared on the rule.
3. Sort by `priority` descending.
4. Evaluate conditions against `AdmissionEvent` using a small path-expression helper (`lodash.get`-style or custom).
5. Collect all matching rules **or** first-match depending on mode:
   - **POC default:** evaluate all matching rules; merge actions with explicit precedence (higher priority wins on conflicting keys); union `rulesApplied`.
6. If no rule matches → Decision `NO_NOA_REQUIRED` (or configurable default).
7. Persist `rule_executions` + `decisions`.
8. Emit audit: `Rules Evaluated`, `Decision Created`.

## Supported Operators (POC)

Keep intentionally small:

- `eq`, `neq`
- `in`, `notIn`
- `exists`
- `gt`, `gte`, `lt`, `lte` (dates/numbers)

Boolean combinators: `all` (AND), `any` (OR), `not`.

**Not in POC:** full CEL/FEEL, nested scripting, ML models.

## Versioning

- `rules` table = identity + current metadata
- `rule_versions` = immutable versioned conditions/actions
- Executions reference specific version IDs

Effective dating: only versions where `effectiveDate <= asOf` and (`expirationDate` is null or `> asOf`) are candidates.

## Separation of Concerns

| Engine | Answers |
|--------|---------|
| **Rules** | Is an NOA required? What type/priority? |
| **Routing** | Where does it go? Which contract/adapter? |
| **Contracts** | What payload/transport/ack policy? |

Rules **must not** hard-code Salesforce vs Pega destinations.

## Seed Rules (Planned)

1. `MEDICARE_INPATIENT_NOA` — golden path SEND_NOA
2. `OUTPATIENT_NO_NOA` — explicit NO_NOA_REQUIRED for outpatient (demo)
3. Optional: missing payer → REJECT (or handled as validation)

## Testing

- Unit: condition evaluator, merge precedence
- Integration: seed rules + AdmissionEvent fixtures → expected Decision
- Exception: NOA not required scenario from fixtures
