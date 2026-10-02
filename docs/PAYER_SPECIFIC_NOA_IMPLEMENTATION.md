# Payer-Specific NOA Implementation Report

**Date:** 2026-09-10  
**Scope:** Extend NOA accelerator with published payer requirements, brand-specific rules, contract profiles, transforms, golden tests, and decision explanation UI.

---

## Status

**FULLY IMPLEMENTED** (POC scope — no live payer APIs)

Demonstrates:

```text
Same Meridian Admission
  → Same FHIR Bundle structure
  → Same Canonical Admission Event (clinical)
  → Different Coverage / payer brand
  → Payer-specific rule matching
  → Payer-specific decision + evidence
  → Payer-specific contract profile
  → Payer-specific SYNTHETIC_DEMO_TRANSFORM
  → Mock delivery + audit
```

---

## Payers

| Payer | Rule | Contract profile | Transform |
| ----- | ---- | ---------------- | --------- |
| Aetna | `AETNA-COMM-INPATIENT-NOTIFICATION-001` | `AETNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1` | `AETNA_ADMISSION_NOTIFICATION_V1` |
| Cigna | `CIGNA-COMM-INPATIENT-NOTIFICATION-001` | `CIGNA_COMMERCIAL_INPATIENT_NOTIFICATION_V1` | `CIGNA_ADMISSION_NOTIFICATION_V1` |
| BCBS Arizona | `BCBSAZ-COMM-INPATIENT-NOTIFICATION-001` | `BCBSAZ_COMMERCIAL_INPATIENT_NOTIFICATION_V1` | `BCBSAZ_ADMISSION_NOTIFICATION_V1` |

---

## Evidence (authoritative sources used)

See `/docs/PAYER_REQUIREMENTS.md` for full citations. Primary sources include:

- Aetna 2026 Participating Provider Precertification List  
- Aetna precertification overview + Precertification and Referral Guide  
- Aetna Office Manual (admissions protocol)  
- Cigna Healthcare Precertifications and Prior Authorizations page  
- Cigna Online Precertification Guide 2025  
- AZ Blue Inpatient Admissions Quick Guide + Provider Operating Guide §11  

---

## Rule differences (actual)

| Dimension | Aetna | Cigna | BCBS AZ |
| --------- | ----- | ----- | ------- |
| Notification | Required (report) | Required (report) | Required (post-admit notice) |
| Timing | **2 business days** (emergency→IP) | **1 business day** (emergency→IP) | **48 hours** (commercial post-admit) |
| Authorization | Not required for emergency services; IP confinements on precert list (separate) | Not required for emergency; elective precert separate | **Code/plan dependent** (separate from notification) |
| Channel nuance | UNKNOWN for exact notification channel | Inpatient notification **not** via online precert tool | Availity / fax / phone documented |

Differences come from configuration + sources, not hard-coded demo forks.

---

## Contract differences

Brand profiles outscore `COMMERCIAL_NOA_MOCK_V1` via payer-brand specificity. Each profile carries distinct:

- transform code  
- required fields  
- transport / channel metadata  
- notification window  
- `sourceType: PUBLISHED_PAYER_REQUIREMENT_PROFILE`  

---

## Transformation differences (real vs synthetic)

| Aspect | Status |
| ------ | ------ |
| Field selection aligned to published required-info lists | Real (documentation-backed) |
| Timing / channel constants embedded in payload | Real (documentation-backed) |
| Exact production EDI/API schema | **Synthetic** — labeled `SYNTHETIC_DEMO_TRANSFORM` |
| Live endpoints / credentials | Not implemented (mock adapter) |

---

## Golden test

`tests/integration/payer-specific-noa.test.ts`

Same canonical Meridian inpatient FHIR (pneumonia, Jacksonville facility); only Coverage/payer Organization differs across Aetna / Cigna / BCBS AZ.

Asserts distinct: matched rule, rule version, decision explanation, contract, contract version, transform, and payload markers — not merely payer name.

---

## Remaining gaps

- Actual provider–payer negotiated contracts (`PROVIDER_PAYER_CONTRACT`)  
- Production payload specs / companion guides  
- Live Availity / phone / fax / EDI connectivity  
- Full prior authorization / PAS / DTR  
- Holiday-aware business calendars  
- Facility/network-level published exceptions beyond brand baseline  

---

## Architecture preserved

```text
FHIR → validate → normalize → rules (WHAT) → decision
  → contract profile (HOW) → transform → deliver → ack → audit
```

Docs:

- `/docs/PAYER_REQUIREMENTS.md`  
- `/docs/PAYER_CONTRACT_PROFILES.md`  
- `/docs/PAYER_RULE_MATCHING.md`  
- `/docs/PAYER_SOURCE_TRACEABILITY.md`  
- `/docs/PAYER_SPECIFIC_NOA_IMPLEMENTATION.md` (this file)
