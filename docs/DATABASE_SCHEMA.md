# Database Schema Proposal — FHIR NOA Accelerator

## Overview

PostgreSQL (Supabase) schema for the POC. Designed for clarity and the primary relationship chain:

```
Event → AdmissionEvent → RuleExecution → Decision
  → Contract/Destination/Transformation → Notification → DeliveryAttempt → Audit
```

Naming: `snake_case` tables/columns. UUIDs as primary keys unless noted. Timestamps `timestamptz`.

This is a **proposal** for Foundation (Step 3). Migrations will implement it; adjustments require updating this doc.

---

## Enum-Like Check Constraints (POC)

Use `text` + check constraints or Postgres enums. Prefer `text` + checks for easier evolution:

- `processing_state`
- `decision_outcome`
- `delivery_attempt_status`
- `audit_status`

---

## Tables

### `organizations`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text NOT NULL | |
| created_at | timestamptz | |

### `users`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | Matches Supabase auth.users.id when linked |
| organization_id | uuid FK | |
| email | text | |
| display_name | text | |
| role | text | e.g. `admin` |
| created_at | timestamptz | |

### `source_systems`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| code | text UNIQUE | `SYNTHETIC_EHR` |
| name | text | |
| active | boolean | default true |
| created_at | timestamptz | |

### `events`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | eventId |
| correlation_id | text UNIQUE NOT NULL | |
| event_type | text NOT NULL | `ADMISSION` |
| source_system_id | uuid FK NULL | |
| received_at | timestamptz NOT NULL | |
| content_type | text | |
| processing_state | text NOT NULL | |
| raw_payload | jsonb NOT NULL | Full FHIR Bundle (synthetic) |
| error_summary | text | Non-PHI |
| created_at / updated_at | timestamptz | |

Indexes: `correlation_id`, `processing_state`, `received_at DESC`.

### `event_resources`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid FK | |
| resource_type | text | Patient, Encounter, … |
| resource_id | text | FHIR id |
| resource | jsonb | Optional extract for UI |

### `admission_events`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid UNIQUE FK | |
| correlation_id | text NOT NULL | |
| canonical | jsonb NOT NULL | Full AdmissionEvent document |
| event_timestamp | timestamptz | |
| payer_type | text | Denormalized for queries |
| encounter_class | text | Denormalized |
| created_at | timestamptz | |

### `rules`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| name | text UNIQUE | `MEDICARE_INPATIENT_NOA` |
| description | text | |
| priority | int | |
| active | boolean | |
| created_at / updated_at | timestamptz | |

### `rule_versions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| rule_id | uuid FK | |
| version | int NOT NULL | |
| effective_date | timestamptz | |
| expiration_date | timestamptz NULL | |
| conditions | jsonb NOT NULL | |
| actions | jsonb NOT NULL | |
| UNIQUE(rule_id, version) | | |

### `rule_executions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid FK | |
| correlation_id | text | |
| started_at / completed_at | timestamptz | |
| input_snapshot | jsonb | Paths used, not extra PHI |
| matched_rule_version_ids | uuid[] | |
| result_summary | jsonb | |

### `decisions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid FK | |
| correlation_id | text | |
| decision | text | `SEND_NOA`, … |
| notification_required | boolean | |
| notification_type | text | |
| priority | text | |
| rules_applied | text[] | |
| rule_version_refs | text[] | |
| payload | jsonb | Full decision document |
| created_at | timestamptz | |

### `destinations`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| code | text UNIQUE | |
| name | text | |
| adapter_key | text NOT NULL | |
| endpoint | text | |
| auth_type | text | |
| auth_config | jsonb | Env var **names** only |
| active | boolean | |
| created_at | timestamptz | |

### `contracts`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| contract_id | text UNIQUE | Business key `MEDICARE_NOA_V1` |
| name | text | |
| payer | text | |
| product | text | |
| active | boolean | |

### `contract_versions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| contract_id | uuid FK | |
| version | int | |
| effective_date / expiration_date | timestamptz | |
| payload_format | text | |
| transport | text | |
| destination_id | uuid FK | |
| transformer_code | text | |
| acknowledgement_type | text | |
| retry_policy | jsonb | |
| required_fields | jsonb | |
| UNIQUE(contract_id, version) | | |

### `contract_fields`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| contract_version_id | uuid FK | |
| field_path | text | |
| required | boolean | |
| description | text | |

### `transformations`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| code | text UNIQUE | |
| name | text | |
| active | boolean | |

### `transformation_versions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| transformation_id | uuid FK | |
| version | int | |
| source_model | text | `AdmissionEvent` |
| target_format | text | |
| mappings | jsonb NOT NULL | |
| UNIQUE(transformation_id, version) | | |

### `notifications`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| event_id | uuid FK | |
| correlation_id | text | |
| decision_id | uuid FK | |
| contract_version_id | uuid FK | |
| destination_id | uuid FK | |
| transformation_version_id | uuid FK | |
| adapter_key | text | |
| request_payload | jsonb | |
| status | text | |
| created_at / updated_at | timestamptz | |

### `delivery_attempts`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| notification_id | uuid FK | |
| attempt_number | int | |
| attempted_at | timestamptz | |
| status | text | `SUCCESS`, `FAILURE`, … |
| status_code | int | |
| response_summary | text | Truncated |
| error_message | text | |
| retryable | boolean | |
| next_retry_at | timestamptz NULL | |
| acknowledgement | jsonb NULL | |

### `audit_events`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| correlation_id | text NOT NULL | |
| event_id | uuid | |
| timestamp | timestamptz NOT NULL | |
| component | text | |
| action | text | |
| status | text | |
| detail | jsonb | |
| error_code | text | |
| error_message | text | |
| reference_map | jsonb | Related IDs |

Indexes: `(correlation_id, timestamp)`, `event_id`.

### `errors`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| correlation_id | text | |
| event_id | uuid | |
| stage | text | |
| code | text | |
| message | text | |
| details | jsonb | |
| created_at | timestamptz | |

### `dead_letters`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid PK | |
| notification_id | uuid FK | |
| event_id | uuid | |
| correlation_id | text | |
| reason | text | |
| last_error | text | |
| payload_snapshot | jsonb | |
| created_at | timestamptz | |

---

## Seed Data (Planned)

- Source system `SYNTHETIC_EHR`
- Rule `MEDICARE_INPATIENT_NOA` v1
- Destinations: `MOCK_PAYER`, `SF_NOA_MOCK`, `PEGA_NOA_MOCK`
- Contracts linking Medicare NOA → each destination + transform
- Transform mappings for mock / SF-shaped / Pega-shaped payloads

---

## RLS (Sketch)

- `authenticated` role: SELECT on operational tables for admin UI
- Ingest writes: server service role after API authentication
- Refine in Foundation; deny-by-default

## Migration Strategy

1. Single initial migration creating all tables + indexes
2. Seed SQL separate under `/supabase/seed`
3. No destructive revisions without doc update
