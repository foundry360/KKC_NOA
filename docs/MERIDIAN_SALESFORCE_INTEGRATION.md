# Meridian Clinical → Salesforce Admission Integration (Demo)

Clicking **Admit Patient** in Meridian Clinical admits the patient, generates the
FHIR R4 admission Bundle, and creates a Salesforce `Admission__c` record whose
`Payload__c` field contains that Bundle. Synthetic/demo data only — no PHI.

```text
Meridian Browser
   │  server action (no Salesforce or Supabase keys in the browser)
   ▼
Meridian server (Next.js)            admitPatient() → FHIR Bundle (existing)
   │  HTTPS POST, Authorization: Bearer <service role>
   ▼
Supabase Edge Function  submit-admission-to-salesforce
   │  1. validate request (JSON, FHIR resourceType, ≤ 130,768 chars)
   │  2. claim_integration_submission()  ← duplicate guard (Postgres)
   │  3. OAuth 2.0 Client Credentials    ← SF_CLIENT_ID_hlsDev / SF_CLIENT_SECRET_hlsDev
   │  4. POST {instance_url}/services/data/v67.0/sobjects/Admission__c
   │  5. record SUBMITTED / FAILED / RETRYABLE
   ▼
Salesforce  Admission__c.Payload__c = FHIR Bundle (pretty-printed JSON)
```

## Components

| Piece | Location |
| --- | --- |
| Admit action (unchanged admission + FHIR generation) | `src/meridian/store/runtime.ts` → `admitPatient()` |
| Salesforce submission (local guard, retry, status) | `src/meridian/store/runtime.ts` → `submitAdmissionToSalesforce()` |
| Server-side Edge Function client | `src/meridian/services/salesforce-client.ts` |
| Server actions | `app/meridian/actions.ts` → `submitAdmissionToSalesforceAction` |
| Admit progress UI | `app/meridian/patients/[id]/admit/admit-form.tsx` |
| Status / details / payload / retry UI | `app/meridian/admissions/[id]/page.tsx`, `salesforce-submit-button.tsx` |
| Edge Function entry (Deno) | `supabase/functions/submit-admission-to-salesforce/index.ts` |
| Salesforce core (auth, create, 401 retry, validation, handler) | `supabase/functions/submit-admission-to-salesforce/salesforce.ts` |
| Status table + claim RPC | `supabase/migrations/20261002000006_meridian_salesforce_integration.sql` |

`salesforce.ts` has no runtime-specific imports so the same code runs in the
Edge Function and in Vitest.

## Flow

1. **Admit Patient** → `admitPatientAction` → `admitPatient()` (existing):
   validation, encounter creation, FHIR R4 message Bundle, NOA send. A
   `SalesforceSubmissionRecord` is created with status `PENDING`.
2. The form then calls `submitAdmissionToSalesforceAction(encounterId)`; the UI
   shows *Admitting Patient… → Generating FHIR Admission… → Sending to
   Salesforce… → Salesforce Admission Created / Submission Failed*.
3. The admission confirmation page shows separate **Admission**, **FHIR**, and
   **Salesforce** statuses, the record ID (linked to Salesforce), submission
   time, attempts, sanitized error, a Retry button, and the exact `Payload__c`.

A Salesforce failure never marks the admission as failed; the encounter stays
`Admitted` and the Salesforce status becomes `FAILED` or `RETRYABLE`.

## Identifier

`admissionId` = the Meridian encounter id (the canonical admission identifier
already used throughout Meridian). The FHIR Bundle id is
`meridian-admission-{encounterId}`.

## Edge Function contract

`POST /functions/v1/submit-admission-to-salesforce`

Request (service-role bearer required — the gateway verifies the JWT and the
function additionally requires `role = service_role`, so the public anon key
cannot create records):

```json
{ "admissionId": "<encounter id>", "payload": "<serialized FHIR Bundle>" }
```

Responses:

| HTTP | Body |
| --- | --- |
| 201 | `{ "success": true, "status": "submitted", "salesforceRecordId": "a0X…", "salesforceRecordUrl": "…", "attemptCount": 1 }` |
| 200 | Same, plus `"duplicate": true` — already submitted; no new record created |
| 409 | `{ "success": false, "status": "submitting", "errorType": "DUPLICATE_IN_PROGRESS" }` |
| 400 / 413 | `VALIDATION` / `PAYLOAD_TOO_LARGE` (never truncated) |
| 502 | `status: "failed"` — `SALESFORCE_VALIDATION`, `SALESFORCE_AUTHENTICATION`, `CONFIGURATION` |
| 503 | `status: "retryable"` — `SALESFORCE_CONNECTION` (network, 429, 5xx), `STATUS_STORE` |

Salesforce `401` on record creation triggers one fresh token request and one
retry, never more. Tokens are requested per transaction (no caching).

## Duplicate prevention

- Browser: the Admit button and Retry button are disabled and ref-guarded while a request is in flight.
- Meridian server: `SUBMITTED` admissions are never resent; an in-process
  in-flight set blocks concurrent submissions for the same admission.
- Edge Function: `claim_integration_submission` atomically moves the row
  (`unique(admission_id, integration_type)`) to `SUBMITTING` only from
  `PENDING`, `FAILED`, `RETRYABLE`, or a `SUBMITTING` older than 120 s.
  Anything else returns the existing state without calling Salesforce.

Known edge: if the function crashes after Salesforce created the record but
before the status write, the row is reclaimable after 120 s and a retry could
create a second record. Acceptable for the demo.

## Database

`public.meridian_integration_submissions`: `admission_id`, `integration_type`,
`status` (`PENDING|SUBMITTING|SUBMITTED|FAILED|RETRYABLE`),
`salesforce_record_id`, `salesforce_record_url`, `submitted_at`,
`last_attempt_at`, `error_type`, `error_message`, `http_status`,
`attempt_count`, `payload_sha256`, `payload_length`, timestamps.

RLS is enabled with no policies (service role only). The FHIR payload is not
duplicated here (only its hash and length); tokens and secrets are never stored.

## Configuration

### Supabase Edge Function secrets (never in the repo, browser, or `.env*`)

| Secret | Value |
| --- | --- |
| `SF_CLIENT_ID_hlsDev` | Connected App consumer key (provided separately) |
| `SF_CLIENT_SECRET_hlsDev` | Connected App consumer secret (provided separately) |
| `SF_API_VERSION` | `v67.0` |
| `SF_LOGIN_BASE_URL` | `https://extraordinary-astro-253310-dev-ed.develop.my.salesforce.com` |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected into Edge Functions automatically.

### Meridian (Next.js server env)

Uses the existing `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. Optional
`SALESFORCE_SUBMIT_FUNCTION_URL` overrides the function URL.

## Deploy

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
# 1. Apply the migration (or paste the SQL into the Supabase SQL editor)
npx supabase db push
# 2. Secrets — type values interactively / from a local untracked file
npx supabase secrets set SF_API_VERSION=v67.0 \
  SF_LOGIN_BASE_URL=https://extraordinary-astro-253310-dev-ed.develop.my.salesforce.com
npx supabase secrets set SF_CLIENT_ID_hlsDev=... SF_CLIENT_SECRET_hlsDev=...
# 3. Function
npx supabase functions deploy submit-admission-to-salesforce
```

## Logging

The function logs JSON metadata only: event, admission id, Salesforce record
id, HTTP status, error type, attempt count, timestamp. It never logs the client
secret, access token, Authorization header, OAuth response, or payload. Error
messages returned to Meridian pass through `sanitizeMessage()`.

## Tests

- `tests/unit/salesforce-admission-integration.test.ts` — token success/failure/missing
  credentials, 201, 401 single retry, validation error, network/5xx, payload
  limits/validation, duplicate handling, secret-free logs.
- `tests/integration/meridian-salesforce.test.ts` — real Meridian admit +
  submission through the real Edge Function handler with mocked Salesforce:
  payload unchanged in `Payload__c`, record id persisted, failure ≠ success,
  retry reuses the same payload, duplicate prevention (local and durable).

No automated test calls the live Salesforce org.

## Out of scope

Salesforce rules engine, FHIR Healthcare API, Health Cloud objects, Apex,
MuleSoft, real payer integrations, PHI, production auth, event queues.
