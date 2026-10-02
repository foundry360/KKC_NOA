# Payer Source Traceability

Every payer-brand rule and contract profile carries provenance that is persisted on the decision and available in the Admin event UI.

---

## Rule provenance (example)

```text
Rule ID:        AETNA-COMM-INPATIENT-NOTIFICATION-001
Payer:          Aetna
Product:        Commercial
Requirement:    Emergency→IP reporting within two business days
Source Type:    PUBLISHED_PAYER_REQUIREMENT
Source:         Aetna Participating Provider Precertification List (2026)
Source URL:     https://www.aetna.com/.../2026_Precert_List.pdf
Effective:      2026-08-01
Verified:       2026-09-10
Evidence:       Emergency services section (reporting within two business days)
Version:        1.0
```

Stored on rule `actions.provenance` and copied into `Decision.explanation.sources`.

---

## Contract profile provenance

Stored on `ContractVersionRecord.profile.sourceReference` with:

- `requirementIds` linking to the requirements library  
- `source` / `sourceUrl` / `verificationDate` / `evidence`  
- `sourceType = PUBLISHED_PAYER_REQUIREMENT_PROFILE`

---

## UI surfaces

NOA Admin `/events/[id]`:

- Admission context (patient, encounter, facility, coverage, payer, plan)  
- Rule evaluation (id, version, reason, sources)  
- Decision + authorization requirement + timing  
- Contract profile + source type + source reference  
- Execution (transform, destination, delivery status, ack, retries)

Meridian remains the clinical EHR; explanation lives in the accelerator.

---

## Integrity rules

- Do not fabricate requirements.  
- Mark gaps `UNKNOWN`.  
- Label synthetic transforms `SYNTHETIC_DEMO_TRANSFORM`.  
- Never present mock delivery acknowledgement as authorization approved.
