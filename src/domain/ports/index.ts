import type { AdmissionEvent } from "../admission/admission-event";
import type {
  ContractSelectionInput,
  ContractVersionRecord,
  DestinationConfig,
} from "../contracts/contract";
import type { Decision, DecisionRecord } from "../decisions/decision";
import type {
  DeliveryAttemptRecord,
  DeliveryOutcome,
  DeliveryRequest,
  DeliveryResult,
  NotificationRecord,
} from "../delivery/delivery";
import type { AuditEntry, DeadLetterRecord } from "../delivery/audit";
import type { InboundEvent } from "../events/inbound-event";
import type { EvaluationContext, RoutingResult } from "../routing/routing";
import type { RuleVersion } from "../rules/rule";
import type {
  TransformationDefinition,
  TransformResult,
} from "../transformations/transformation";
import type { CorrelationId, ProcessingState, UUID } from "../types";

export interface IdGenerator {
  eventId(): UUID;
  correlationId(prefix?: string): CorrelationId;
}

export interface Clock {
  now(): Date;
}

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export interface EventRepository {
  save(event: InboundEvent): Promise<void>;
  updateState(
    eventId: UUID,
    state: ProcessingState,
    errorSummary?: string
  ): Promise<void>;
  findById(eventId: UUID): Promise<InboundEvent | null>;
  findByCorrelationId(correlationId: CorrelationId): Promise<InboundEvent | null>;
  listRecent(limit: number): Promise<InboundEvent[]>;
}

export interface AdmissionEventRepository {
  save(admission: AdmissionEvent): Promise<void>;
  findByEventId(eventId: UUID): Promise<AdmissionEvent | null>;
}

export interface DecisionRepository {
  save(decision: DecisionRecord): Promise<void>;
  findByEventId(eventId: UUID): Promise<DecisionRecord | null>;
}

export interface RuleRepository {
  listActiveVersions(asOf: Date, eventType?: string): Promise<RuleVersion[]>;
}

export interface ContractRepository {
  findMatching(input: ContractSelectionInput): Promise<ContractVersionRecord[]>;
}

export interface TransformationRepository {
  findByCodeVersion(code: string, version?: number): Promise<TransformationDefinition | null>;
}

export interface DestinationRepository {
  findById(id: UUID): Promise<DestinationConfig | null>;
  findByCode(code: string): Promise<DestinationConfig | null>;
}

export interface NotificationRepository {
  save(notification: NotificationRecord): Promise<void>;
  updateStatus(id: UUID, status: string): Promise<void>;
  findByEventId(eventId: UUID): Promise<NotificationRecord | null>;
}

export interface DeliveryAttemptRepository {
  save(attempt: DeliveryAttemptRecord): Promise<void>;
  listByNotificationId(notificationId: UUID): Promise<DeliveryAttemptRecord[]>;
}

export interface AuditPort {
  record(entry: AuditEntry): Promise<void>;
  listByCorrelationId(correlationId: CorrelationId): Promise<AuditEntry[]>;
  listRecent(limit: number): Promise<AuditEntry[]>;
}

export interface DeadLetterRepository {
  save(entry: DeadLetterRecord): Promise<void>;
}

export interface FhirValidator {
  validate(bundle: unknown): Promise<FhirValidationResult>;
}

export interface FhirValidationResult {
  ok: boolean;
  errors: Array<{ path?: string; message: string; code: string }>;
}

export interface NormalizationService {
  toAdmissionEvent(
    bundle: unknown,
    meta: { eventId: UUID; correlationId: CorrelationId; sourceSystem: string }
  ): Promise<AdmissionEvent>;
}

export interface RulesEngine {
  evaluate(event: AdmissionEvent, context?: EvaluationContext): Promise<Decision>;
}

export interface RoutingEngine {
  route(event: AdmissionEvent, decision: Decision): Promise<RoutingResult>;
}

export interface ContractRegistry {
  resolve(input: ContractSelectionInput): Promise<RoutingResult | null>;
}

export interface TransformationEngine {
  transform(
    event: AdmissionEvent,
    definition: TransformationDefinition,
    decision?: Decision
  ): Promise<TransformResult>;
}

export interface DeliveryAdapter {
  readonly key: string;
  send(request: DeliveryRequest): Promise<DeliveryResult>;
}

export interface DeliveryAdapterRegistry {
  get(key: string): DeliveryAdapter;
}

export interface DeliveryService {
  deliver(input: {
    event: AdmissionEvent;
    decision: Decision;
    routing: RoutingResult;
    payload: Record<string, unknown>;
    decisionRecord?: DecisionRecord;
  }): Promise<DeliveryOutcome>;
}

export interface PipelineResult {
  eventId: UUID;
  correlationId: CorrelationId;
  processingState: ProcessingState;
  decision?: Decision;
  routing?: {
    contractBusinessId: string;
    destinationCode: string;
    adapterKey: string;
    transformerCode: string;
  };
  transformation?: {
    transformerCode: string;
    payload: Record<string, unknown>;
  };
  delivery?: {
    notificationId: string;
    adapterKey: string;
    attempts: number;
    acknowledgement?: { acknowledgedAt: string; ackId?: string };
    deadLetter?: boolean;
  };
  acknowledgement?: { acknowledgedAt: string; ackId?: string };
  errors?: Array<{ code: string; message: string }>;
}

export interface NoaPipeline {
  process(input: {
    rawBody: unknown;
    contentType: string;
    correlationId?: string;
    sourceSystem?: string;
    /** Demo override: MEDICARE_NOA_SF_V1 | MEDICARE_NOA_PEGA_V1 | … */
    contractBusinessId?: string;
  }): Promise<PipelineResult>;
}
