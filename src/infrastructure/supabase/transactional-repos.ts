import type { SupabaseClient } from "@supabase/supabase-js";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { DecisionRecord } from "@/src/domain/decisions/decision";
import type { AuditEntry, DeadLetterRecord } from "@/src/domain/delivery/audit";
import type {
  DeliveryAttemptRecord,
  NotificationRecord,
} from "@/src/domain/delivery/delivery";
import type { InboundEvent } from "@/src/domain/events/inbound-event";
import type {
  AdmissionEventRepository,
  AuditPort,
  DeadLetterRepository,
  DecisionRepository,
  DeliveryAttemptRepository,
  EventRepository,
  NotificationRepository,
} from "@/src/domain/ports";
import type {
  CorrelationId,
  EventType,
  ProcessingState,
  UUID,
} from "@/src/domain/types";
import type {
  RuleExecutionRecord,
  RuleExecutionRepository,
} from "@/src/services/decisioning/decisioning-service";
import type {
  RoutingSelectionRecord,
  RoutingSelectionRepository,
} from "@/src/services/routing/routing-service";
import type {
  TransformationRecord,
  TransformationResultRepository,
} from "@/src/services/transformation/transformation-service";
import { throwIfError } from "./errors";

type SourceSystemJoin = { code: string } | { code: string }[] | null;

function sourceCodeFromJoin(join: SourceSystemJoin): string | undefined {
  if (!join) return undefined;
  if (Array.isArray(join)) return join[0]?.code;
  return join.code;
}

function mapEvent(row: {
  id: string;
  correlation_id: string;
  event_type: string;
  source_system_id: string | null;
  received_at: string;
  content_type: string | null;
  processing_state: string;
  raw_payload: unknown;
  error_summary: string | null;
  created_at: string;
  updated_at: string;
  source_systems?: SourceSystemJoin;
}): InboundEvent {
  return {
    id: row.id,
    correlationId: row.correlation_id as CorrelationId,
    eventType: row.event_type as EventType,
    sourceSystemId: row.source_system_id,
    sourceSystemCode: sourceCodeFromJoin(row.source_systems ?? null) ?? undefined,
    receivedAt: row.received_at,
    contentType: row.content_type ?? "application/fhir+json",
    processingState: row.processing_state as ProcessingState,
    rawPayload: row.raw_payload,
    errorSummary: row.error_summary,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseEventRepository implements EventRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async resolveSourceSystemId(
    code?: string
  ): Promise<string | null> {
    if (!code) return null;
    const { data, error } = await this.client
      .from("source_systems")
      .select("id")
      .eq("code", code)
      .maybeSingle();
    throwIfError(error, "resolve source_system");
    return data?.id ?? null;
  }

  async save(event: InboundEvent): Promise<void> {
    const sourceSystemId =
      event.sourceSystemId ??
      (await this.resolveSourceSystemId(event.sourceSystemCode));

    const { error } = await this.client.from("events").upsert(
      {
        id: event.id,
        correlation_id: event.correlationId,
        event_type: event.eventType,
        source_system_id: sourceSystemId,
        received_at: event.receivedAt,
        content_type: event.contentType,
        processing_state: event.processingState,
        raw_payload: event.rawPayload,
        error_summary: event.errorSummary ?? null,
        created_at: event.createdAt ?? event.receivedAt,
        updated_at: event.updatedAt ?? event.receivedAt,
      },
      { onConflict: "id" }
    );
    throwIfError(error, "events.save");
  }

  async updateState(
    eventId: UUID,
    state: ProcessingState,
    errorSummary?: string
  ): Promise<void> {
    const patch: Record<string, unknown> = {
      processing_state: state,
      updated_at: new Date().toISOString(),
    };
    if (errorSummary !== undefined) {
      patch.error_summary = errorSummary;
    }
    const { error } = await this.client
      .from("events")
      .update(patch)
      .eq("id", eventId);
    throwIfError(error, "events.updateState");
  }

  async findById(eventId: UUID): Promise<InboundEvent | null> {
    const { data, error } = await this.client
      .from("events")
      .select("*, source_systems(code)")
      .eq("id", eventId)
      .maybeSingle();
    throwIfError(error, "events.findById");
    return data ? mapEvent(data) : null;
  }

  async findByCorrelationId(
    correlationId: CorrelationId
  ): Promise<InboundEvent | null> {
    const { data, error } = await this.client
      .from("events")
      .select("*, source_systems(code)")
      .eq("correlation_id", correlationId)
      .maybeSingle();
    throwIfError(error, "events.findByCorrelationId");
    return data ? mapEvent(data) : null;
  }

  async listRecent(limit: number): Promise<InboundEvent[]> {
    const { data, error } = await this.client
      .from("events")
      .select("*, source_systems(code)")
      .order("received_at", { ascending: false })
      .limit(limit);
    throwIfError(error, "events.listRecent");
    return (data ?? []).map(mapEvent);
  }
}

export class SupabaseAdmissionEventRepository
  implements AdmissionEventRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async save(admission: AdmissionEvent): Promise<void> {
    const { error } = await this.client.from("admission_events").upsert(
      {
        event_id: admission.eventId,
        correlation_id: admission.correlationId,
        canonical: admission,
        event_timestamp: admission.eventTimestamp,
        payer_type: admission.payer.payerType ?? null,
        encounter_class: admission.encounter.class,
      },
      { onConflict: "event_id" }
    );
    throwIfError(error, "admission_events.save");
  }

  async findByEventId(eventId: UUID): Promise<AdmissionEvent | null> {
    const { data, error } = await this.client
      .from("admission_events")
      .select("canonical")
      .eq("event_id", eventId)
      .maybeSingle();
    throwIfError(error, "admission_events.findByEventId");
    return (data?.canonical as AdmissionEvent | undefined) ?? null;
  }
}

export class SupabaseDecisionRepository implements DecisionRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(decision: DecisionRecord): Promise<void> {
    const { error } = await this.client.from("decisions").upsert(
      {
        id: decision.id,
        event_id: decision.eventId,
        correlation_id: decision.correlationId,
        decision: decision.decision,
        notification_required: decision.notificationRequired,
        notification_type: decision.notificationType ?? null,
        priority: decision.priority ?? null,
        rules_applied: decision.rulesApplied,
        rule_version_refs: decision.ruleVersions,
        payload: decision.payload,
        created_at: decision.createdAt,
      },
      { onConflict: "id" }
    );
    throwIfError(error, "decisions.save");
  }

  async findByEventId(eventId: UUID): Promise<DecisionRecord | null> {
    const { data, error } = await this.client
      .from("decisions")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error, "decisions.findByEventId");
    if (!data) return null;
    return {
      id: data.id,
      eventId: data.event_id,
      correlationId: data.correlation_id,
      decision: data.decision,
      notificationRequired: data.notification_required,
      notificationType: data.notification_type ?? undefined,
      priority: data.priority ?? undefined,
      rulesApplied: data.rules_applied ?? [],
      ruleVersions: data.rule_version_refs ?? [],
      payload: data.payload,
      createdAt: data.created_at,
    };
  }
}

export class SupabaseRuleExecutionRepository
  implements RuleExecutionRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async save(execution: RuleExecutionRecord): Promise<void> {
    const matchedIds = execution.matchedRuleVersions.filter((id) =>
      /^[0-9a-f-]{36}$/i.test(id)
    );
    const { error } = await this.client.from("rule_executions").upsert(
      {
        id: execution.id,
        event_id: execution.eventId,
        correlation_id: execution.correlationId,
        started_at: execution.startedAt,
        completed_at: execution.completedAt,
        input_snapshot: execution.inputSnapshot,
        matched_rule_version_ids: matchedIds,
        result_summary: execution.resultSummary,
      },
      { onConflict: "id" }
    );
    throwIfError(error, "rule_executions.save");
  }

  async findByEventId(eventId: UUID): Promise<RuleExecutionRecord | null> {
    const { data, error } = await this.client
      .from("rule_executions")
      .select("*")
      .eq("event_id", eventId)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error, "rule_executions.findByEventId");
    if (!data) return null;
    return {
      id: data.id,
      eventId: data.event_id,
      correlationId: data.correlation_id,
      startedAt: data.started_at,
      completedAt: data.completed_at ?? data.started_at,
      inputSnapshot: data.input_snapshot ?? {},
      matchedRuleVersions: data.matched_rule_version_ids ?? [],
      resultSummary: data.result_summary,
    };
  }
}

export class SupabaseAuditPort implements AuditPort {
  constructor(private readonly client: SupabaseClient) {}

  async record(entry: AuditEntry): Promise<void> {
    const { error } = await this.client.from("audit_events").insert({
      id: entry.id,
      correlation_id: entry.correlationId,
      event_id: entry.eventId ?? null,
      timestamp: entry.timestamp,
      component: entry.component,
      action: entry.action,
      status: entry.status,
      detail: entry.detail ?? null,
      error_code: entry.errorCode ?? null,
      error_message: entry.errorMessage ?? null,
      reference_map: entry.references ?? null,
    });
    throwIfError(error, "audit_events.record");
  }

  async listByCorrelationId(
    correlationId: CorrelationId
  ): Promise<AuditEntry[]> {
    const { data, error } = await this.client
      .from("audit_events")
      .select("*")
      .eq("correlation_id", correlationId)
      .order("timestamp", { ascending: true });
    throwIfError(error, "audit_events.listByCorrelationId");
    return (data ?? []).map(mapAudit);
  }

  async listRecent(limit: number): Promise<AuditEntry[]> {
    const { data, error } = await this.client
      .from("audit_events")
      .select("*")
      .order("timestamp", { ascending: false })
      .limit(limit);
    throwIfError(error, "audit_events.listRecent");
    return (data ?? []).map(mapAudit);
  }
}

function mapAudit(row: {
  id: string;
  correlation_id: string;
  event_id: string | null;
  timestamp: string;
  component: string;
  action: string;
  status: string;
  detail: Record<string, unknown> | null;
  error_code: string | null;
  error_message: string | null;
  reference_map: Record<string, unknown> | null;
}): AuditEntry {
  return {
    id: row.id,
    correlationId: row.correlation_id as CorrelationId,
    eventId: row.event_id ?? undefined,
    timestamp: row.timestamp,
    component: row.component,
    action: row.action,
    status: row.status as AuditEntry["status"],
    detail: row.detail ?? undefined,
    errorCode: row.error_code ?? undefined,
    errorMessage: row.error_message ?? undefined,
    references: row.reference_map ?? undefined,
  };
}

export class SupabaseRoutingSelectionRepository
  implements RoutingSelectionRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async save(selection: RoutingSelectionRecord): Promise<void> {
    const { error } = await this.client.from("routing_selections").upsert(
      {
        id: selection.id,
        event_id: selection.eventId,
        correlation_id: selection.correlationId,
        contract_business_id: selection.contractBusinessId,
        contract_version_id: selection.contractVersionId,
        destination_code: selection.destinationCode,
        adapter_key: selection.adapterKey,
        transformer_code: selection.transformerCode,
        routing: selection.routing,
        created_at: selection.createdAt,
      },
      { onConflict: "event_id" }
    );
    throwIfError(error, "routing_selections.save");
  }

  async findByEventId(
    eventId: UUID
  ): Promise<RoutingSelectionRecord | null> {
    const { data, error } = await this.client
      .from("routing_selections")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    throwIfError(error, "routing_selections.findByEventId");
    if (!data) return null;
    return {
      id: data.id,
      eventId: data.event_id,
      correlationId: data.correlation_id,
      contractBusinessId: data.contract_business_id,
      contractVersionId: data.contract_version_id,
      destinationCode: data.destination_code,
      adapterKey: data.adapter_key,
      transformerCode: data.transformer_code,
      createdAt: data.created_at,
      routing: data.routing,
    };
  }
}

export class SupabaseTransformationResultRepository
  implements TransformationResultRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async save(record: TransformationRecord): Promise<void> {
    const { error } = await this.client.from("transformation_results").upsert(
      {
        id: record.id,
        event_id: record.eventId,
        correlation_id: record.correlationId,
        transformer_code: record.transformerCode,
        transformer_version: record.transformerVersion,
        payload: record.payload,
        mapping_trace: record.mappingTrace,
        created_at: record.createdAt,
      },
      { onConflict: "event_id" }
    );
    throwIfError(error, "transformation_results.save");
  }

  async findByEventId(eventId: UUID): Promise<TransformationRecord | null> {
    const { data, error } = await this.client
      .from("transformation_results")
      .select("*")
      .eq("event_id", eventId)
      .maybeSingle();
    throwIfError(error, "transformation_results.findByEventId");
    if (!data) return null;
    return {
      id: data.id,
      eventId: data.event_id,
      correlationId: data.correlation_id,
      transformerCode: data.transformer_code,
      transformerVersion: data.transformer_version,
      payload: data.payload,
      mappingTrace: data.mapping_trace ?? [],
      createdAt: data.created_at,
    };
  }
}

export class SupabaseNotificationRepository implements NotificationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(notification: NotificationRecord): Promise<void> {
    const { error } = await this.client.from("notifications").upsert(
      {
        id: notification.id,
        event_id: notification.eventId,
        correlation_id: notification.correlationId,
        decision_id: notification.decisionId,
        contract_version_id: notification.contractVersionId,
        destination_id: notification.destinationId,
        transformation_version_id: notification.transformationVersionId,
        adapter_key: notification.adapterKey,
        request_payload: notification.requestPayload,
        status: notification.status,
        created_at: notification.createdAt,
        updated_at: notification.updatedAt,
      },
      { onConflict: "id" }
    );
    throwIfError(error, "notifications.save");
  }

  async updateStatus(id: UUID, status: string): Promise<void> {
    const { error } = await this.client
      .from("notifications")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    throwIfError(error, "notifications.updateStatus");
  }

  async findByEventId(eventId: UUID): Promise<NotificationRecord | null> {
    const { data, error } = await this.client
      .from("notifications")
      .select("*")
      .eq("event_id", eventId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    throwIfError(error, "notifications.findByEventId");
    return data ? mapNotification(data) : null;
  }

  async listAll(): Promise<NotificationRecord[]> {
    const { data, error } = await this.client
      .from("notifications")
      .select("*")
      .order("created_at", { ascending: false });
    throwIfError(error, "notifications.listAll");
    return (data ?? []).map(mapNotification);
  }
}

function mapNotification(row: {
  id: string;
  event_id: string;
  correlation_id: string;
  decision_id: string | null;
  contract_version_id: string | null;
  destination_id: string | null;
  transformation_version_id: string | null;
  adapter_key: string | null;
  request_payload: Record<string, unknown> | null;
  status: string;
  created_at: string;
  updated_at: string;
}): NotificationRecord {
  return {
    id: row.id,
    eventId: row.event_id,
    correlationId: row.correlation_id as CorrelationId,
    decisionId: row.decision_id ?? "",
    contractVersionId: row.contract_version_id ?? "",
    destinationId: row.destination_id ?? "",
    transformationVersionId: row.transformation_version_id ?? "",
    adapterKey: row.adapter_key ?? "",
    requestPayload: row.request_payload ?? {},
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export class SupabaseDeliveryAttemptRepository
  implements DeliveryAttemptRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async save(attempt: DeliveryAttemptRecord): Promise<void> {
    const { error } = await this.client.from("delivery_attempts").upsert(
      {
        id: attempt.id,
        notification_id: attempt.notificationId,
        attempt_number: attempt.attemptNumber,
        attempted_at: attempt.attemptedAt,
        status: attempt.status,
        status_code: attempt.statusCode ?? null,
        response_summary: attempt.responseSummary ?? null,
        error_message: attempt.errorMessage ?? null,
        retryable: attempt.retryable ?? null,
        next_retry_at: attempt.nextRetryAt ?? null,
        acknowledgement: attempt.acknowledgement ?? null,
      },
      { onConflict: "id" }
    );
    throwIfError(error, "delivery_attempts.save");
  }

  async listByNotificationId(
    notificationId: UUID
  ): Promise<DeliveryAttemptRecord[]> {
    const { data, error } = await this.client
      .from("delivery_attempts")
      .select("*")
      .eq("notification_id", notificationId)
      .order("attempt_number", { ascending: true });
    throwIfError(error, "delivery_attempts.listByNotificationId");
    return (data ?? []).map((row) => ({
      id: row.id,
      notificationId: row.notification_id,
      attemptNumber: row.attempt_number,
      attemptedAt: row.attempted_at,
      status: row.status,
      statusCode: row.status_code ?? undefined,
      responseSummary: row.response_summary ?? undefined,
      errorMessage: row.error_message ?? undefined,
      retryable: row.retryable ?? undefined,
      nextRetryAt: row.next_retry_at,
      acknowledgement: row.acknowledgement ?? undefined,
    }));
  }
}

export class SupabaseDeadLetterRepository implements DeadLetterRepository {
  constructor(private readonly client: SupabaseClient) {}

  async save(entry: DeadLetterRecord): Promise<void> {
    const { error } = await this.client.from("dead_letters").upsert(
      {
        id: entry.id,
        notification_id: entry.notificationId,
        event_id: entry.eventId,
        correlation_id: entry.correlationId,
        reason: entry.reason,
        last_error: entry.lastError ?? null,
        payload_snapshot: entry.payloadSnapshot ?? null,
        created_at: entry.createdAt,
      },
      { onConflict: "id" }
    );
    throwIfError(error, "dead_letters.save");
  }

  async listAll(): Promise<DeadLetterRecord[]> {
    const { data, error } = await this.client
      .from("dead_letters")
      .select("*")
      .order("created_at", { ascending: false });
    throwIfError(error, "dead_letters.listAll");
    return (data ?? []).map((row) => ({
      id: row.id,
      notificationId: row.notification_id,
      eventId: row.event_id,
      correlationId: row.correlation_id,
      reason: row.reason,
      lastError: row.last_error ?? undefined,
      payloadSnapshot: row.payload_snapshot ?? undefined,
      createdAt: row.created_at,
    }));
  }
}
