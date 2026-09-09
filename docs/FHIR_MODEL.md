# FHIR Model — FHIR NOA Accelerator

## Role of FHIR

FHIR R4 is the **inbound integration format** for the POC. The platform is **not** a full FHIR server.

Responsibilities at the FHIR edge:

- Accept `application/fhir+json` (and optionally `application/json` with FHIR Bundle body)
- Validate structure and required resources for the NOA admission use case
- Persist the raw Bundle for audit/traceability
- Map into canonical `AdmissionEvent`

Internal business logic operates on `AdmissionEvent`, not Bundle resource graphs.

## Supported Profile (POC)

**Resource:** FHIR R4 `Bundle`  
**Type:** Prefer `message` (with `MessageHeader`); `collection` accepted if required resources are present.

### Expected Resources

| Resource | Role | Required for golden path |
|----------|------|---------------------------|
| `MessageHeader` | Event metadata, source, focus | Preferred |
| `Patient` | Subject | Yes |
| `Encounter` | Admission encounter | Yes |
| `Coverage` | Payer coverage | Yes (for payer routing) |
| `Organization` | Facility and/or payer | Yes (facility; payer via Coverage.payor) |
| `Practitioner` | Providers | Optional but supported |

### Out of Scope FHIR Features

- Full CapabilityStatement / conformance server
- Write APIs for Patient/Encounter CRUD
- Terminology services
- SMART on FHIR launch
- Subscriptions
- Full US Core validation suite (optional later; POC uses targeted validation)

## Example Bundle Shape (Conceptual)

```json
{
  "resourceType": "Bundle",
  "type": "message",
  "timestamp": "2026-09-09T14:30:00Z",
  "entry": [
    { "resource": { "resourceType": "MessageHeader", "...": "..." } },
    { "resource": { "resourceType": "Patient", "...": "..." } },
    { "resource": { "resourceType": "Encounter", "class": { "code": "IMP" }, "...": "..." } },
    { "resource": { "resourceType": "Coverage", "...": "..." } },
    { "resource": { "resourceType": "Organization", "...": "..." } },
    { "resource": { "resourceType": "Practitioner", "...": "..." } }
  ]
}
```

Synthetic fixtures live under `/fhir/fixtures`. **No real PHI.**

## Validation Strategy (POC)

Validation is intentional and scoped:

1. **Content-type** check at listener
2. **JSON parse** + `resourceType === Bundle`
3. **Presence checks** for Patient, Encounter, Coverage (and MessageHeader when `type === message`)
4. **Semantic checks** needed for NOA demo:
   - Encounter class mappable to inpatient/outpatient
   - Encounter period start (admission datetime)
   - Coverage payor resolvable to a payer type (e.g. Medicare via coding or Organization identifier)
5. **Optional:** lightweight schema validation (Zod or similar) — not a full FHIR validator product

Failures → `VALIDATION_FAILED`, audit entry, persisted raw payload, no silent drop.

## Normalization Mapping (FHIR → AdmissionEvent)

High-level mappings (implemented in NormalizationService):

| Canonical path | FHIR source (typical) |
|----------------|------------------------|
| `eventTimestamp` | Bundle.timestamp or MessageHeader.eventTiming / meta |
| `patient.*` | Patient |
| `encounter.class` | Encounter.class (map `IMP` → `INPATIENT`) |
| `encounter.period` | Encounter.period |
| `admission.admissionDateTime` | Encounter.period.start |
| `facility.*` | Encounter.serviceProvider → Organization |
| `coverage.*` | Coverage |
| `payer.*` | Coverage.payor → Organization / coding |
| `providers.*` | Encounter.participant → Practitioner |
| `diagnoses.*` | Encounter.diagnosis / Condition references (if present in fixture) |
| `sourceMetadata` | MessageHeader.source, Bundle.id, request headers (non-PHI) |

Unmapped or missing optional fields are null/empty arrays — required-field failures are validation or rule outcomes, not silent defaults that invent clinical data.

## Listener Contract (Conceptual)

```
POST /api/fhir/r4/events
```

**Headers:**

- `Content-Type: application/fhir+json` (preferred)
- `X-Correlation-Id` (optional; generated if absent)
- Auth per POC security model

**Behavior:**

1. Accept body
2. Generate/accept correlation ID
3. Validate content type
4. Persist inbound event (`RECEIVED`)
5. FHIR validate
6. Normalize → `AdmissionEvent`
7. Continue pipeline (or enqueue — POC may run sync)
8. Return acknowledgement (HTTP 202 Accepted recommended for async-style; 200 with body acceptable for POC sync)

Listener **must not** contain NOA business rules.

Detailed request/response schemas: `API_CONTRACT.md` (Foundation phase).

## Fixtures & Profiles

| Path | Purpose |
|------|---------|
| `/fhir/fixtures/admission-medicare-inpatient.json` | Golden path |
| `/fhir/fixtures/admission-invalid-*.json` | Exception demos |
| `/fhir/fixtures/admission-no-noa-required.json` | Rules reject / not required |
| `/fhir/profiles/` | Informal profile notes / required element lists |

## Future Events

Additional FHIR message types (discharge, referral, etc.) will add fixtures and normalizers to new canonical types. Shared Bundle ingest path and audit/lifecycle remain.
