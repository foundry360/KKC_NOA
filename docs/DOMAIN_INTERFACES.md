# Domain Interfaces Proposal — FHIR NOA Accelerator

TypeScript-oriented port definitions for the domain and application layers. Implementations live under `/src/infrastructure` and `/src/adapters`. These are **contracts**; signatures may tighten during Foundation without changing intent.

## Identifiers & Cross-Cutting

```typescript
type UUID = string;
type CorrelationId = string; // e.g. NOA-20260909-000123
type ProcessingState =
  | "RECEIVED"
  | "VALIDATED"
  | "NORMALIZED"
  | "EVALUATED"
  | "ROUTED"
  | "TRANSFORMED"
  | "DELIVERED"
  | "ACKNOWLEDGED"
  | "VALIDATION_FAILED"
  | "RULE_REJECTED"
  | "NO_CONTRACT"
  | "TRANSFORM_FAILED"
  | "DELIVERY_FAILED"
  | "RETRY_PENDING"
  | "DEAD_LETTER";

interface IdGenerator {
  eventId(): UUID;
  correlationId(prefix?: string): CorrelationId;
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

## Canonical Admission Event (summary)

```typescript
interface AdmissionEvent {
  eventId: UUID;
  correlationId: CorrelationId;
  sourceSystem: string;
  eventType: "ADMISSION";
  eventTimestamp: string; // ISO
  patient: CanonicalPatient;
  encounter: CanonicalEncounter;
  admission: CanonicalAdmission;
  facility: CanonicalFacility;
  payer: CanonicalPayer;
  coverage: CanonicalCoverage;
  diagnoses: CanonicalDiagnosis[];
  providers: CanonicalProvider[];
  sourceMetadata: Record<string, unknown>;
}
```

Nested types detailed in implementation under `/src/domain/admission`.

## Persistence Ports

```typescript
interface EventRepository {
  save(event: InboundEvent): Promise<void>;
  updateState(eventId: UUID, state: ProcessingState, errorSummary?: string): Promise<void>;
  findById(eventId: UUID): Promise<InboundEvent | null>;
  findByCorrelationId(correlationId: CorrelationId): Promise<InboundEvent | null>;
  listRecent(limit: number): Promise<InboundEvent[]>;
}

interface AdmissionEventRepository {
  save(admission: AdmissionEvent): Promise<void>;
  findByEventId(eventId: UUID): Promise<AdmissionEvent | null>;
}

interface DecisionRepository {
  save(decision: DecisionRecord): Promise<void>;
  findByEventId(eventId: UUID): Promise<DecisionRecord | null>;
}

interface RuleRepository {
  listActiveVersions(asOf: Date, eventType?: string): Promise<RuleVersion[]>;
}

interface ContractRepository {
  findMatching(input: ContractSelectionInput): Promise<ContractVersionRecord[]>;
}

interface TransformationRepository {
  findByCodeVersion(code: string, version?: number): Promise<TransformationDefinition | null>;
}

interface DestinationRepository {
  findById(id: UUID): Promise<DestinationConfig | null>;
  findByCode(code: string): Promise<DestinationConfig | null>;
}

interface NotificationRepository {
  save(notification: NotificationRecord): Promise<void>;
  updateStatus(id: UUID, status: string): Promise<void>;
  findByEventId(eventId: UUID): Promise<NotificationRecord | null>;
}

interface DeliveryAttemptRepository {
  save(attempt: DeliveryAttemptRecord): Promise<void>;
  listByNotificationId(notificationId: UUID): Promise<DeliveryAttemptRecord[]>;
}

interface AuditPort {
  record(entry: AuditEntry): Promise<void>;
  listByCorrelationId(correlationId: CorrelationId): Promise<AuditEntry[]>;
}

interface DeadLetterRepository {
  save(entry: DeadLetterRecord): Promise<void>;
}
```

## FHIR Edge

```typescript
interface FhirValidator {
  validate(bundle: unknown): Promise<FhirValidationResult>;
}

interface FhirValidationResult {
  ok: boolean;
  errors: Array<{ path?: string; message: string; code: string }>;
}

interface NormalizationService {
  toAdmissionEvent(
    bundle: unknown,
    meta: { eventId: UUID; correlationId: CorrelationId; sourceSystem: string }
  ): Promise<AdmissionEvent>;
}
```

## Rules, Routing, Transform, Delivery

```typescript
interface RulesEngine {
  evaluate(event: AdmissionEvent, context?: EvaluationContext): Promise<Decision>;
}

interface Decision {
  decision: "SEND_NOA" | "NO_NOA_REQUIRED" | "REJECT";
  notificationRequired: boolean;
  notificationType?: "NOA" | string;
  priority?: "HIGH" | "NORMAL" | "LOW" | string;
  rulesApplied: string[];
  ruleVersions: string[];
}

interface RoutingEngine {
  route(event: AdmissionEvent, decision: Decision): Promise<RoutingResult>;
}

interface RoutingResult {
  destination: DestinationConfig;
  contractVersion: ContractVersionRecord;
  transformation: TransformationDefinition;
  adapterKey: string;
}

interface ContractRegistry {
  resolve(input: ContractSelectionInput): Promise<RoutingResult | null>;
}

interface TransformationEngine {
  transform(
    event: AdmissionEvent,
    definition: TransformationDefinition
  ): Promise<TransformResult>;
}

interface TransformResult {
  payload: Record<string, unknown>;
  mappingTrace: MappingTraceEntry[];
}

interface DeliveryAdapter {
  readonly key: string;
  send(request: DeliveryRequest): Promise<DeliveryResult>;
}

interface DeliveryAdapterRegistry {
  get(key: string): DeliveryAdapter;
}

interface DeliveryService {
  deliver(input: {
    event: AdmissionEvent;
    decision: Decision;
    routing: RoutingResult;
    payload: Record<string, unknown>;
  }): Promise<DeliveryOutcome>;
}
```

## Pipeline Orchestrator

```typescript
interface NoaPipeline {
  process(input: {
    rawBody: unknown;
    contentType: string;
    correlationId?: string;
    sourceSystem?: string;
  }): Promise<PipelineResult>;
}

interface PipelineResult {
  eventId: UUID;
  correlationId: CorrelationId;
  processingState: ProcessingState;
  decision?: Decision;
  acknowledgement?: Acknowledgement;
  errors?: Array<{ code: string; message: string }>;
}
```

The HTTP listener depends on `NoaPipeline` (or equivalently composed services), **not** on rules/contracts directly.

## Adapter Keys (POC)

```typescript
type AdapterKey =
  | "mock"
  | "rest"
  | "salesforce"
  | "pega"
  | "fhir"
  | "webhook"
  | "queue";
```

Unimplemented keys throw a clear configuration error if selected.

## Dependency Rule

```
app/api/*  →  services  →  domain ports
                ↓
         infrastructure / adapters
```

React components call server actions or read APIs; they do **not** import rules evaluation or transform logic.
