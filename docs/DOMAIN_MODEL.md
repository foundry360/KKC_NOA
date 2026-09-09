# Domain Model — FHIR NOA Accelerator

## Principle

FHIR is an **integration edge format**. Internal processing uses a canonical domain model, starting with `AdmissionEvent`.

```
FHIR Bundle → Validation → AdmissionEvent → Rules → Decision → …
```

Not:

```
FHIR Bundle → Business Logic Everywhere
```

The original inbound FHIR payload is **preserved for traceability** but is not the core business object.

## Core Aggregates & Entities

### SourceSystem

Represents an upstream sender (EHR, HIE, clearinghouse, test harness).

| Field | Description |
|-------|-------------|
| `id` | UUID |
| `code` | Stable code (e.g. `SYNTHETIC_EHR`) |
| `name` | Display name |
| `active` | Whether accepted for ingest |

### Event (Inbound Envelope)

Generic inbound event record for any future healthcare event type.

| Field | Description |
|-------|-------------|
| `id` / `eventId` | UUID |
| `correlationId` | Trace key |
| `eventType` | e.g. `ADMISSION` (extensible) |
| `sourceSystemId` | FK / reference |
| `receivedAt` | Ingest timestamp |
| `contentType` | e.g. `application/fhir+json` |
| `processingState` | Lifecycle state |
| `rawPayloadRef` | Reference to stored FHIR payload |
| `errorSummary` | Non-PHI error summary when failed |

### EventResource

Optional normalized index of FHIR resources extracted from the Bundle (for display/debug), not the business model.

### AdmissionEvent (Canonical)

Canonical admission notification used by rules, routing, and transform.

| Field | Description |
|-------|-------------|
| `eventId` | Links to Event |
| `correlationId` | Trace key |
| `sourceSystem` | Code / name |
| `eventType` | `ADMISSION` |
| `eventTimestamp` | Clinical/business event time |
| `patient` | Canonical patient |
| `encounter` | Canonical encounter |
| `admission` | Admission-specific attributes |
| `facility` | Facility / organization |
| `payer` | Payer organization |
| `coverage` | Coverage summary |
| `diagnoses` | List of diagnosis codes/displays |
| `providers` | Attending / referring practitioners |
| `sourceMetadata` | Non-PHI ingest metadata |

#### Nested Value Objects (conceptual)

**Patient:** `id`, `mrn` (synthetic), `name` (family, given), `birthDate`, `gender`, `identifiers`

**Encounter:** `id`, `status`, `class` (e.g. `INPATIENT`), `period.start`, `period.end`, `type`

**Admission:** `admissionDateTime`, `admissionType`, `pointOfOrigin`, `admitSource`

**Facility:** `id`, `npi`, `name`, `address`, `type`

**Payer:** `id`, `name`, `payerType` (e.g. `MEDICARE`), `identifiers`

**Coverage:** `id`, `subscriberId` (synthetic), `status`, `payorRef`, `plan`, `period`

**Provider:** `id`, `npi`, `name`, `role`

**Diagnosis:** `code`, `system`, `display`, `rank`, `type`

### ProcessingState

Enum (string union in TypeScript):

```
RECEIVED | VALIDATED | NORMALIZED | EVALUATED | ROUTED |
TRANSFORMED | DELIVERED | ACKNOWLEDGED |
VALIDATION_FAILED | RULE_REJECTED | NO_CONTRACT |
TRANSFORM_FAILED | DELIVERY_FAILED | RETRY_PENDING | DEAD_LETTER
```

### Rule / RuleVersion

Configurable rule definitions. See [RULE_ENGINE.md](./RULE_ENGINE.md).

### RuleExecution

Record of evaluating rules against an event: inputs snapshot (non-PHI keys), matched rules, timing.

### Decision

Explicit output of the rules engine.

Example shape:

```json
{
  "decision": "SEND_NOA",
  "notificationRequired": true,
  "notificationType": "NOA",
  "priority": "HIGH",
  "rulesApplied": ["MEDICARE_INPATIENT_NOA"],
  "ruleVersions": ["MEDICARE_INPATIENT_NOA@1"]
}
```

Possible decision outcomes for POC:

- `SEND_NOA`
- `NO_NOA_REQUIRED`
- `REJECT` (rule rejection / insufficient data after validate)

### Contract / ContractVersion / ContractField

Destination contract metadata. See [CONTRACT_REGISTRY.md](./CONTRACT_REGISTRY.md).

### Destination

Where to send: endpoint, transport, auth type, adapter key (`mock` | `rest` | `salesforce` | `pega` | …).

### Transformation / TransformationVersion

Field mappings from canonical paths to destination fields. See [TRANSFORMATION_ENGINE.md](./TRANSFORMATION_ENGINE.md).

### Notification

Outbound notification instance tied to an event + decision + contract.

### DeliveryAttempt

Each send try: attempt number, status, HTTP/status codes, response summary, error, next retry.

### AuditEvent

Append-only processing history entry:

| Field | Description |
|-------|-------------|
| `correlationId` | Trace |
| `eventId` | Event |
| `timestamp` | When |
| `component` | e.g. `fhir-validation`, `rules-engine` |
| `action` | e.g. `VALIDATED`, `DECISION_CREATED` |
| `status` | `SUCCESS` \| `FAILURE` \| `INFO` |
| `detail` | Non-PHI structured detail |
| `errorCode` / `errorMessage` | When failed |
| `references` | Related IDs (decision, contract, attempt) |

### Error / DeadLetter

Operational failure records; dead letters after exhausted retries per contract policy.

### Organization / User

Admin tenancy stubs for Supabase Auth linkage (POC-simple).

## Relationship Chain (Most Important)

```
Event
  → AdmissionEvent
  → RuleExecution
  → Decision
  → (Routing) Contract + Destination + Transformation
  → Notification
  → DeliveryAttempt(s)
  → AuditEvent(s)
```

## Domain Ports (Interfaces)

Domain defines ports; infrastructure implements them. Illustrative TypeScript:

```typescript
interface EventRepository {
  save(event: InboundEvent): Promise<void>;
  updateState(eventId: string, state: ProcessingState): Promise<void>;
  findById(eventId: string): Promise<InboundEvent | null>;
  findByCorrelationId(correlationId: string): Promise<InboundEvent | null>;
}

interface AdmissionEventRepository {
  save(admission: AdmissionEvent): Promise<void>;
  findByEventId(eventId: string): Promise<AdmissionEvent | null>;
}

interface RulesEngine {
  evaluate(event: AdmissionEvent, context: EvaluationContext): Promise<Decision>;
}

interface ContractRegistry {
  resolve(input: ContractSelectionInput): Promise<ResolvedContract | null>;
}

interface RoutingEngine {
  route(event: AdmissionEvent, decision: Decision): Promise<RoutingResult>;
}

interface TransformationEngine {
  transform(event: AdmissionEvent, definition: TransformationDefinition): Promise<DestinationPayload>;
}

interface DeliveryAdapter {
  readonly key: string;
  send(request: DeliveryRequest): Promise<DeliveryResult>;
}

interface AuditPort {
  record(entry: AuditEntry): Promise<void>;
  listByCorrelationId(correlationId: string): Promise<AuditEntry[]>;
}

interface IdGenerator {
  eventId(): string;
  correlationId(prefix?: string): string;
}

interface Clock {
  now(): Date;
}

interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
```

**Constraint:** Ports must not expose Supabase types, Salesforce SDK types, or Pega types.

## Extensibility for Future Events

`Event.eventType` and parallel canonical models (e.g. `DischargeEvent`) can be added without redesigning:

- Integration listener (path or type discriminator)
- Rules / contracts keyed by event type + product
- Shared lifecycle, audit, delivery, and UI patterns

POC implements **ADMISSION / NOA** only.

## Non-PHI Logging Rule

Domain objects may contain synthetic demographics for processing and UI display. Application logs and generic error streams must prefer IDs (`eventId`, `correlationId`) over names, MRNs, or dates of birth.
