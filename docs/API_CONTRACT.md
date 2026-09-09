# API Contract — FHIR NOA Accelerator

## Inbound FHIR Events

### `GET /api/fhir/r4/events`

Health/discovery for the ingest endpoint.

**Response `200`**

```json
{
  "service": "fhir-noa-accelerator",
  "endpoint": "/api/fhir/r4/events",
  "status": "ready",
  "accepts": ["application/fhir+json", "application/json"],
    "pipelineThrough": "TRANSFORMED",
}
```

---

### `POST /api/fhir/r4/events`

Receives a FHIR R4 Bundle representing an admission notification.

Through Step 8 the pipeline processes:

```
RECEIVED → VALIDATED → NORMALIZED → EVALUATED → ROUTED → TRANSFORMED → DELIVERED → ACKNOWLEDGED
```

(or `VALIDATION_FAILED` / `RULE_REJECTED` / `NO_CONTRACT` / `TRANSFORM_FAILED` / `DEAD_LETTER`)

#### Headers

| Header | Required | Description |
|--------|----------|-------------|
| `Content-Type` | Yes | `application/fhir+json` (preferred) or `application/json` |
| `X-API-Key` | Conditional | Required when `FHIR_INGEST_API_KEY` is set |
| `Authorization` | Conditional | `Bearer <key>` accepted as alternative to `X-API-Key` |
| `X-Correlation-Id` | No | If omitted, server generates `NOA-YYYYMMDD-######` |
| `X-Contract-Id` | No | Demo override for contract business id (SF/Pega/Mock) |

#### Auth (POC)

- If `FHIR_INGEST_API_KEY` is **set**, requests must present the matching key.
- If **unset**, ingest is open for local development (not for production).

#### Request body

FHIR R4 `Bundle` JSON. See `docs/FHIR_MODEL.md` and `/fhir/fixtures`.

#### Success response `202 Accepted`

Processing completed through `TRANSFORMED` when NOA is required (sync POC: ingest + rules + contract + transform).

```json
{
  "eventId": "uuid",
  "correlationId": "NOA-20260909-000001",
  "processingState": "TRANSFORMED",
  "eventType": "ADMISSION",
  "admissionEvent": {
    "encounterClass": "INPATIENT",
    "payerType": "MEDICARE",
    "admissionDateTime": "2026-09-09T14:30:00Z",
    "facilityName": "Synthetic General Hospital"
  },
  "decision": {
    "decision": "SEND_NOA",
    "notificationRequired": true,
    "notificationType": "NOA",
    "priority": "HIGH",
    "rulesApplied": ["MEDICARE_INPATIENT_NOA"],
    "ruleVersions": ["MEDICARE_INPATIENT_NOA@1"]
  },
  "routing": {
    "contractBusinessId": "MEDICARE_NOA_MOCK_V1",
    "destinationCode": "MOCK_PAYER",
    "adapterKey": "mock",
    "transformerCode": "MEDICARE_NOA_MOCK_TRANSFORM"
  },
  "transformation": {
    "transformerCode": "MEDICARE_NOA_MOCK_TRANSFORM",
    "payload": {
      "notificationType": "NOA",
      "admissionDateTime": "2026-09-09T14:30:00.000Z",
      "patient": { "lastName": "SYNTHETIC", "firstName": "ADA" },
      "encounterClass": "INPATIENT",
      "payerType": "MEDICARE",
      "correlationId": "NOA-20260909-000001"
    }
  }
}
```

Response includes `X-Correlation-Id` header.

The full canonical `AdmissionEvent` is persisted (in-memory when Supabase is not configured) and is not echoed in full to avoid accidental PHI logging in clients. Synthetic data is used in the POC.

#### Validation failure `422 Unprocessable Entity`

Event is **persisted** with `processingState: VALIDATION_FAILED` (never silently discarded).

```json
{
  "eventId": "uuid",
  "correlationId": "NOA-20260909-000002",
  "processingState": "VALIDATION_FAILED",
  "eventType": "ADMISSION",
  "errors": [
    { "code": "MISSING_PATIENT", "message": "Patient resource is required", "path": "entry" }
  ]
}
```

#### Client errors

| Status | Code | When |
|--------|------|------|
| 400 | `VALIDATION_ERROR` | Unsupported content type |
| 400 | `INVALID_JSON` | Body is not JSON |
| 401 | `UNAUTHORIZED` | Missing/invalid API key when required |
| 500 | `INTERNAL_ERROR` | Unexpected failure |

#### Example (golden path)

```bash
curl -sS -X POST http://localhost:3000/api/fhir/r4/events \
  -H "Content-Type: application/fhir+json" \
  -H "X-API-Key: $FHIR_INGEST_API_KEY" \
  -H "X-Correlation-Id: NOA-20260909-000123" \
  --data @fhir/fixtures/admission-medicare-inpatient.json
```

---

## Admin UI APIs

Deferred until UI cascade (Step 10). Admin pages currently use placeholders.

## Notes

- FHIR is an edge format; internal model is `AdmissionEvent`.
- Steps 5+ extend the same ingest path into rules → delivery without changing this listener's business-rule-free contract.
- Persistence: process-local in-memory repositories when Supabase env is not configured; Supabase-backed repositories replace the composition root later without changing this API.
