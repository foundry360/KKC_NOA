# Payer Rule & Contract Matching

## Principle

> Rules decide **WHAT**. Contracts decide **HOW**.

Rules must not embed transport endpoints or payer payload formatting. Contract profiles select destination, transform, channels, and operational metadata.

---

## Rule matching

1. Load active rule versions effective at event time.  
2. Evaluate conditions against the canonical `AdmissionEvent`.  
3. Collect all matches.  
4. **Conflict:** if two or more matches share the **same priority** and disagree on `actions.decision`, return `REJECT` with `explanation.conflict = true` (no silent pick).  
5. Otherwise merge actions with **higher priority winning**.  
6. Attach explanation: requirement outcome, authorization requirement, timing window/status, provenance sources.

### Seeded precedence (priority)

| Priority | Rule | Scope |
| -------- | ---- | ----- |
| 200 | `AETNA-COMM-INPATIENT-NOTIFICATION-001` | Aetna commercial brand |
| 200 | `CIGNA-COMM-INPATIENT-NOTIFICATION-001` | Cigna commercial brand |
| 200 | `BCBSAZ-COMM-INPATIENT-NOTIFICATION-001` | BCBS Arizona commercial brand |
| 100 | `FACILITY_ADMISSION_NOA` | Any payer inpatient/emergency/observation |
| 90 | `OUTPATIENT_NO_NOA` | Outpatient |

Brand rules and the facility fallback can both match; brand actions win via priority.

---

## Contract matching precedence

Implemented in `src/services/routing/contract-specificity.ts`:

```text
Exact Facility  (+32)
        >
Network         (+16)
        >
State           (+8)
        >
Plan/Product    (+4)
        >
Payer Brand     (+2)
        >
Payer Type      (+1)
        >
Default / unset dimensions (wildcards)
```

Unset dimensions on a contract are wildcards (do not filter; do not add score).

After scoring:

1. Keep only max-score matches.  
2. If multiple distinct brand/profile contracts tie → **configuration conflict** (must resolve).  
3. Medicare multi-destination Mock/SF/Pega (same type, no brand) still uses default/`_MOCK_` preference.

Routing passes `payer.name` (brand) and facility id into selection. Coverage `plan` display names are **not** used as `planProduct` match keys (they are free-text plan labels, not product dimensions).

---

## Timing status

When a notification window is configured:

| Status | Meaning |
| ------ | ------- |
| `DUE` | as-of ≤ deadline |
| `OVERDUE` | as-of > deadline |
| `NOT_REQUIRED` | no notification required |
| `UNKNOWN` | window or start time unavailable |

Business days skip weekends only; holidays are **UNKNOWN** / not modeled.

---

## Determinism

Same admission event + same coverage context + same effective config version ⇒ same decision and contract selection.
