# Meridian Clinical — Mock EHR for FHIR NOA Accelerator POC

## Purpose

**Meridian Clinical** is a simulated enterprise EHR/EMR for **Meridian Health Partners**.

It is **not** a complete EHR. It exists to provide a credible clinical source system that:

1. Displays synthetic patients and charts  
2. Admits a patient with payer/clinical data  
3. Generates a FHIR R4 admission Bundle  
4. Sends that Bundle to the **NOA Accelerator**  
5. Shows notification / acknowledgement status back to the clinician  

## Boundary (non-negotiable)

```
MERIDIAN CLINICAL          NOA ACCELERATOR              PAYER PLATFORMS
(Source system / EHR)  →   (Integration + rules +       →  Salesforce / Pega
                            transform + delivery)          (adapters only)
         FHIR R4 Bundle
```

| System | Owns |
|--------|------|
| Meridian Clinical | Clinical event → FHIR event |
| NOA Accelerator | FHIR → validate → rules → route → transform → deliver → ack |
| Salesforce / Pega | Downstream receipt (mocked adapters) |

Meridian must **not** contain NOA business rules, contract selection, or vendor-specific delivery logic.

## Mount path

Same Next.js app, isolated UI:

- **`/meridian`** — Meridian Clinical (navy enterprise EHR shell)
- **`/`** — NOA Accelerator admin (existing teal orchestration UI)

Do not merge shells. Visual distinction is part of the demo.

## Screens

| Route | Screen |
|-------|--------|
| `/meridian` | Patient Census (filter + New Patient) |
| `/meridian/patients/new` | Registration — create chart |
| `/meridian/patients/[id]` | Patient Chart (demographics, encounter, coverage) |
| `/meridian/patients/[id]/edit` | Edit chart / manage record |
| `/meridian/patients/[id]/admit` | Admit Patient |
| `/meridian/encounters` | Encounters / Admissions list |
| `/meridian/admissions/[id]` | Admission confirmation |
| `/meridian/fhir-events/[id]` | FHIR Event viewer |
| `/meridian/notifications/[id]` | Admission Notification status |
| `/meridian/notifications/[id]/response` | Payer response (ack summary) |

Header search resolves patients by name or MRN. Registration and Admissions are live nav items (not stubs).

POC stubs: Clinical sub-nav items (Medications, Orders, Results, Notes) show “Not implemented in POC”.

## EMR workflows (session store)

| Workflow | How |
|----------|-----|
| Register patient | `/meridian/patients/new` → MRN auto-assigned → chart |
| Search | Header search or census filters |
| Manage record | Chart → **Edit Record** (demographics, coverage, problem, provider) |
| Admit | Chart → **Admit Patient** → FHIR → NOA |
| Discharge | Chart → **Discharge** (clears active encounter; history kept) |
| Encounter list | `/meridian/encounters` |

Data is process-local for the POC (survives HMR via singleton; resets on cold start).

## FHIR generation

On **Admit Patient**, Meridian builds a FHIR R4 `Bundle` (`type: message`) with:

- MessageHeader (A01)
- Patient
- Encounter
- Condition (principal diagnosis)
- Coverage
- Organization (facility + payer)
- Practitioner (attending)

Compatible with `AdmissionFhirValidator` / existing NOA fixtures.

## NOA integration

```ts
sendFhirAdmissionEvent(bundle, options?)
```

- URL: `NOA_ACCELERATOR_URL` (default same-origin `/api/fhir/r4/events`)
- Auth: `FHIR_INGEST_API_KEY` via `X-API-Key` when set
- Headers: `Content-Type: application/fhir+json`, optional `X-Correlation-Id`, `X-Source-System: MERIDIAN_CLINICAL`
- Optional `X-Contract-Id` for vendor demos (not EHR business logic — demo override only)

**Demo Mode:** if the accelerator is unreachable or `MERIDIAN_DEMO_MODE=true`, Meridian simulates a downstream timeline and labels UI as **Demo Mode**.

## Demo journey

1. Open `/meridian`  
2. Select **John Smith**  
3. **Admit Patient** → Inpatient / Emergency / Jacksonville / 4 South 402 / Medicare / Pneumonia / Sarah Williams, MD  
4. Confirm admission → FHIR created → sent to NOA  
5. View FHIR Event + Notification Status (ACKNOWLEDGED / ack id)

## Scenarios

| ID | Setup | Expected (NOA owns outcome) |
|----|--------|------------------------------|
| A | Inpatient / ED / Observation + any payer | SEND_NOA → contract by payer → ACKNOWLEDGED |
| B | Outpatient class | NO_NOA_REQUIRED |
| C | Medicare inpatient | MEDICARE_NOA_MOCK_V1 (default) |
| D | Commercial inpatient (e.g. Maria Garcia / Aetna) | COMMERCIAL_NOA_MOCK_V1 |
| E | Incomplete Bundle (test hook) | Validation failure |

Every Meridian **Admit Patient** creates a real FHIR R4 event and runs the NOA pipeline. Destination adapters are still POC mocks (or SF/Pega when configured); the EMR side is not Medicare-only.

## Assumptions

- Synthetic data only; not HIPAA compliant  
- Desktop-first, information-dense EHR UX  
- No Epic/Cerner branding or copyrighted UI  
- Persistence for Meridian census is in-process for POC; NOA pipeline uses Supabase when configured  

## Implementation phases

1. Shell + visual identity  
2. Synthetic data model  
3. Patient census  
4. Patient chart  
5. Admission workflow  
6. FHIR generation  
7. NOA API client  
8. FHIR event viewer  
9. Notification status  
10. End-to-end demo verification  
