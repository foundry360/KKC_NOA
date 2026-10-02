# Payer Contract Profiles

Contract profiles answer **HOW** a notification should be executed after rules decide **WHAT**.

They are **not** negotiated provider–payer legal contracts unless `sourceType = PROVIDER_PAYER_CONTRACT`.

---

## Source types

| Source type | Meaning |
| ----------- | ------- |
| `PUBLISHED_PAYER_REQUIREMENT_PROFILE` | Operational profile derived from authoritative public payer docs |
| `PROVIDER_PAYER_CONTRACT` | Actual customer negotiated agreement (not present in this POC) |
| `GENERIC_PAYER_TYPE` | Fallback by MEDICARE / COMMERCIAL / MEDICAID |

Never label a published profile as `ACTUAL_PROVIDER_CONTRACT`.

---

## Seeded profiles

| Contract business id | Brand | Transform | Notes |
| -------------------- | ----- | --------- | ----- |
| `AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1` | Aetna | `AETNA_ADMISSION_NOTIFICATION_V1` | 2 business-day emergency→IP window |
| `CIGNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1` | Cigna | `CIGNA_ADMISSION_NOTIFICATION_V1` | 1 business-day window; phone channel |
| `BCBSAZ_COMMERCIAL_INPATIENT_NOTIFICATION_V1` | BCBS AZ | `BCBSAZ_ADMISSION_NOTIFICATION_V1` | 48-hour post-admit; Availity/fax/phone |
| `COMMERCIAL_NOA_MOCK_V1` | (any commercial) | Medicare mock transform | Generic fallback |
| `MEDICARE_NOA_*` / `MEDICAID_NOA_MOCK_V1` | type-level | existing | unchanged |

Profile metadata lives on `ContractVersionRecord.profile` (and DB `contract_versions.profile` jsonb).

---

## Profile fields

Includes: payer brand, plan/product, state, transaction type, notification/authorization requirements, timing window, submission channels, acknowledgement behavior, transform kind, source reference, version/status via contract versioning.

Acknowledgement behavior is explicitly labeled as **mock delivery ack ≠ authorization approval**.

---

## Transformations

Payer transforms are labeled:

```text
transformKind: SYNTHETIC_DEMO_TRANSFORM
```

They include only fields supported by public documentation (or labeled synthetic). They are **not** claimed to be production payer payloads.

---

## Override path (future)

A `PROVIDER_PAYER_CONTRACT` with facility/network dimensions outscores published brand profiles via the matching engine (see `PAYER_RULE_MATCHING.md`).
