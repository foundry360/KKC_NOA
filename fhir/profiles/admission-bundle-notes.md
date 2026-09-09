# Admission Bundle Profile (POC notes)

Informal required elements for NOA ingest — not a published FHIR Implementation Guide.

## Bundle

- `resourceType` = `Bundle`
- `type` = `message` (preferred) or `collection`
- At least one `Patient`, `Encounter`, `Coverage`

## When `type` = `message`

- `MessageHeader` required

## Encounter

- `class.code` present and mappable (`IMP` → INPATIENT, `AMB`/`OUT`/`HH` → OUTPATIENT, etc.)
- `period.start` required (admission datetime)

## Coverage

- `payor` present (reference or display)
- Prefer Organization with payer-type identifier `MEDICARE` | `MEDICAID` | `COMMERCIAL`

## Synthetic data only

Do not use real PHI in fixtures or demos.
