# Payer Requirements Library

**Verified:** 2026-09-10  
**Purpose:** Configurable, source-traceable published payer requirements consumed by rules and contract profiles — not hard-coded `if (payer === "Aetna")` application logic.

---

## Source hierarchy

1. Official payer provider manuals  
2. Official payer provider portals / documentation  
3. Official payer policy documents  
4. Official payer EDI / transaction specifications  
5. Official state / regulatory sources  
6. CMS / federal sources where applicable  

Secondary sources may be used only to locate primary sources. Blogs, vendor marketing, and forums are not authoritative.

If a fact cannot be verified: record **`UNKNOWN`**. Do not invent.

---

## Data model

TypeScript: `src/domain/payer-requirements/types.ts`  
Seed library: `src/infrastructure/seed/payer-requirements.ts`

Each requirement supports (optional fields allowed):

| Dimension | Example |
| --------- | ------- |
| Payer | Aetna |
| Plan/Product | Commercial |
| State | AZ |
| Provider/Facility | (future) |
| Network | (future) |
| Encounter / admission type | INPATIENT / EMERGENCY |
| Effective / expiration | ISO dates |
| Requirement type | ADMISSION_NOTIFICATION, AUTHORIZATION, SUBMISSION_CHANNEL, REQUIRED_INFORMATION |
| Requirement value | Verbatim / structured summary |
| Source metadata | type, document, URL, dates, evidence, version, status |

---

## Research summary (hospital inpatient admission notification)

### Aetna Commercial

| Topic | Finding | Status |
| ----- | ------- | ------ |
| Notification required | Emergency visit → inpatient admission must be **reported** within **two business days** | Verified (2026 Precert List) |
| General admission notify | Office manual: notify hospital admissions within **one business day** | Verified (manual) |
| Authorization | Inpatient confinements on precert list; emergency services generally do not require precert except reporting IP | Verified (partial) |
| Notification vs auth | Aetna distinguishes **notification** (data entry) from **coverage determination** | Verified |
| Required fields | Member ID, DOB, diagnosis, place of service, admit date, NPIs (precert/referral guide) | Verified for request intake |
| Submission / EDI payload | Exact production outbound schema | **UNKNOWN** |
| Ack as authorization | Not documented as auth approval for notification | **UNKNOWN** / treat mock ack as delivery only |

Sources:

- https://www.aetna.com/content/dam/aetna/pdfs/aetnacom/healthcare-professionals/2026_Precert_List.pdf  
- https://www.aetna.com/health-care-professionals/precertification.html  
- https://www.aetna.com/document-library/healthcare-professionals/assets/documents/aetna-precertification-and-referral-guide.pdf  
- https://www.aetna.com/content/dam/aetna/pdfs/aetnacom/health-care-professionals/office_manual_hcp.pdf  

### Cigna Commercial

| Topic | Finding | Status |
| ----- | ------- | ------ |
| Notification required | Emergency → inpatient must be **reported within one business day** (unless state mandate) | Verified |
| Authorization | Precert **not** required for emergency services; elective requires precert when plan requires it | Verified |
| Channel | Inpatient notifications **cannot** use online precert tool; contact Provider Services | Verified (2025 guide) |
| Outbound payload | Production EDI/API schema | **UNKNOWN** |

Sources:

- https://www.cigna.com/health-care-providers/coverage-and-claims/precertification  
- https://campaigns.cigna.com/static/campaigns-cigna-com/docs/pcomm/chc-online-precert-guide-2025.pdf  

### Blue Cross Blue Shield of Arizona (AZ Blue) Commercial

| Topic | Finding | Status |
| ----- | ------- | ------ |
| Notification required | All benefit plans require notice of inpatient admissions | Verified |
| Timing (commercial group/individual) | **Post-admission notification always within 48 hours** | Verified (quick guide) |
| Authorization | Required only for codes/plans that require PA; otherwise pre-admission notification when PA not required | Verified |
| Channels | Availity, fax face sheet, phone | Verified |
| Required info | Member name/DOB/ID, provider NPI/TIN, date/type/place, procedures, diagnoses | Verified |
| Outbound payload | Production EDI/API schema | **UNKNOWN** |

**Note:** Health Choice / AHCCCS materials are a different product line and were **not** used as commercial AZ Blue requirements.

Sources:

- https://edge.sitecorecloud.io/bluecross-6f8ea2ea/media/project/bcbs-az/azblue/data/media/files/providers/resources/prior-auth-and-med-policies/inpatient-admissions-quick-guide.pdf  
- https://edge.sitecorecloud.io/bluecross-6f8ea2ea/media/project/bcbs-az/azblue/data/media/files/providers/e-learning/11-medical-policies-and-prior-authorization-provider-operating-guide.pdf  
- https://www.azblue.com/provider/resources/prior-authorization-and-medical-policies  

---

## Known unknowns

- Exact production transaction formats / EDI companion guides for these three payers’ admission notifications  
- Live acknowledgement semantics (delivery ack vs clinical auth)  
- Facility/network-specific negotiated overrides (require `PROVIDER_PAYER_CONTRACT`)  
- Holiday calendars for business-day timing (weekends only modeled)

---

## Customer-contract override model (future)

```text
PROVIDER_PAYER_CONTRACT  >  PUBLISHED_PAYER_REQUIREMENT  >  GENERIC_PAYER_TYPE
```

Published profiles are baselines. A negotiated contract may refine windows, channels, required fields, or endpoints without changing the FHIR admission event.
