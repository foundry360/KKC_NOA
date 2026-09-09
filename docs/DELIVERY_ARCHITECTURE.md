# Delivery Architecture — FHIR NOA Accelerator

## Purpose

Deliver transformed payloads to downstream systems through a **generic adapter interface**, with attempts, acknowledgements, retries, and dead-letter handling.

```
Destination Payload + Resolved Contract/Destination
  → DeliveryAdapter.send()
  → Acknowledgement
  → Audit
```

## DeliveryAdapter Interface

```typescript
interface DeliveryAdapter {
  readonly key: string; // mock | rest | salesforce | pega | fhir | webhook | queue
  send(request: DeliveryRequest): Promise<DeliveryResult>;
}

interface DeliveryRequest {
  correlationId: string;
  eventId: string;
  notificationId: string;
  destination: DestinationConfig;
  payload: Record<string, unknown>;
  headers?: Record<string, string>;
}

interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  acknowledgement?: Acknowledgement;
  responseBodySummary?: string; // truncated, non-PHI
  errorCode?: string;
  errorMessage?: string;
  retryable?: boolean;
}

interface Acknowledgement {
  acknowledgedAt: string; // ISO
  ackId?: string;
  rawSummary?: string;
}
```

Domain/services depend on this interface only.

## Adapters (POC)

| Adapter | Status | Role |
|---------|--------|------|
| **Mock** | Implemented | Simulates payer endpoint + ack; primary golden path |
| **REST** | Implemented | Real HTTP POST to configurable URL (e.g. httpbin / local mock server) |
| **Salesforce** | Mock stub | Demonstrates adapter swap; no live credentials |
| **Pega** | Mock stub | Same |
| **FHIR** | Stub interface | Future |
| **Webhook** | Stub interface | Future |
| **Queue** | Stub interface | Future (SQS in AWS) |

### Mock Adapter Behavior

- Accepts payload
- Returns success ack with generated `ackId`
- Can be configured (via destination config flags) to simulate: timeout, HTTP 500, retryable failure — for exception demos/tests

### REST Adapter Behavior

- HTTP client with timeout
- Maps HTTP 2xx + optional body parse to acknowledgement
- Non-2xx → failure; 5xx/timeout typically `retryable: true`

### Salesforce / Pega Adapters (POC)

- Same interface
- Internally may call Mock or format payload with SF/Pega-ish envelope fields
- Prove routing without live systems

## Delivery Service Responsibilities

1. Load retry policy from contract
2. Create `notifications` row
3. For attempt 1..N:
   - Insert `delivery_attempts`
   - Call adapter
   - Audit attempt
   - On success → store ack, state `DELIVERED` then `ACKNOWLEDGED`
   - On retryable failure → `RETRY_PENDING`, schedule/next attempt (POC: immediate sequential retries in-process)
4. After max attempts → `DEAD_LETTER`, persist dead_letter record

### Retry Ladder

```
Attempt 1 → Attempt 2 → Attempt 3 → Dead Letter
```

Tracked per attempt: number, timestamp, status code, response summary, error, next retry time.

## Orchestration vs Adapter

| Component | Does |
|-----------|------|
| DeliveryService | Policy, persistence, state transitions, adapter selection by key |
| Adapter | Transport + protocol idiosyncrasies |

Adapters must not update business rules or select contracts.

## Vendor-Agnostic Proof

```
Same FHIR → Same AdmissionEvent → Same Decision
  Contract A → Salesforce adapter
  Contract B → Pega adapter
```

## Error Scenarios (Tests)

1. Downstream timeout
2. Downstream HTTP error
3. Retry then success
4. Exhaust retries → dead letter

## Security Notes

- Auth secrets from environment / secret manager — never committed
- Response bodies truncated and scrubbed before logging
- POC uses synthetic data only

## Production Evolution

Replace in-process retries with SQS + worker; keep `DeliveryAdapter` and attempt schema stable. See `AWS_PRODUCTION_ARCHITECTURE.md`.
