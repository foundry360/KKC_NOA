import { randomUUID } from "node:crypto";
import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision, DecisionRecord } from "@/src/domain/decisions/decision";
import type {
  AuditPort,
  Clock,
  DecisionRepository,
  EventRepository,
  Logger,
  RulesEngine,
} from "@/src/domain/ports";
import type { ProcessingState, UUID } from "@/src/domain/types";

export interface RuleExecutionRecord {
  id: UUID;
  eventId: UUID;
  correlationId: string;
  startedAt: string;
  completedAt: string;
  inputSnapshot: Record<string, unknown>;
  matchedRuleVersions: string[];
  resultSummary: Decision;
}

export interface RuleExecutionRepository {
  save(execution: RuleExecutionRecord): Promise<void>;
  findByEventId(eventId: UUID): Promise<RuleExecutionRecord | null>;
}

export interface DecisioningResult {
  decision: Decision;
  decisionRecord: DecisionRecord;
  processingState: ProcessingState;
}

/**
 * Evaluates rules against a canonical AdmissionEvent and persists the decision.
 * Does not perform routing, transform, or delivery.
 */
export class DecisioningService {
  constructor(
    private readonly deps: {
      clock: Clock;
      logger: Logger;
      rulesEngine: RulesEngine;
      events: EventRepository;
      decisions: DecisionRepository;
      executions: RuleExecutionRepository;
      audit: AuditPort;
    }
  ) {}

  async evaluate(admission: AdmissionEvent): Promise<DecisioningResult> {
    const { clock, logger, rulesEngine, events, decisions, executions, audit } =
      this.deps;

    const startedAt = clock.now().toISOString();
    const decision = await rulesEngine.evaluate(admission, {
      asOf: new Date(admission.eventTimestamp),
    });
    const completedAt = clock.now().toISOString();

    const execution: RuleExecutionRecord = {
      id: randomUUID(),
      eventId: admission.eventId,
      correlationId: admission.correlationId,
      startedAt,
      completedAt,
      inputSnapshot: {
        eventType: admission.eventType,
        encounterClass: admission.encounter.class,
        payerType: admission.payer.payerType,
      },
      matchedRuleVersions: decision.ruleVersions,
      resultSummary: decision,
    };
    await executions.save(execution);

    await audit.record({
      correlationId: admission.correlationId,
      eventId: admission.eventId,
      timestamp: completedAt,
      component: "rules-engine",
      action: "RULES_EVALUATED",
      status: "SUCCESS",
      detail: {
        matchedCount: decision.rulesApplied.length,
        rulesApplied: decision.rulesApplied,
      },
      references: { ruleExecutionId: execution.id },
    });

    const decisionRecord: DecisionRecord = {
      id: randomUUID(),
      eventId: admission.eventId,
      correlationId: admission.correlationId,
      ...decision,
      payload: decision,
      createdAt: completedAt,
    };
    await decisions.save(decisionRecord);

    await audit.record({
      correlationId: admission.correlationId,
      eventId: admission.eventId,
      timestamp: clock.now().toISOString(),
      component: "decisioning",
      action: "DECISION_CREATED",
      status: decision.decision === "REJECT" ? "FAILURE" : "SUCCESS",
      detail: {
        decision: decision.decision,
        notificationRequired: decision.notificationRequired,
        notificationType: decision.notificationType,
        priority: decision.priority,
      },
      references: { decisionId: decisionRecord.id },
    });

    let processingState: ProcessingState = "EVALUATED";
    if (decision.decision === "REJECT") {
      processingState = "RULE_REJECTED";
      await events.updateState(
        admission.eventId,
        processingState,
        "REJECT"
      );
    } else if (decision.decision === "NO_NOA_REQUIRED") {
      processingState = "EVALUATED";
      await events.updateState(admission.eventId, processingState);
      await audit.record({
        correlationId: admission.correlationId,
        eventId: admission.eventId,
        timestamp: clock.now().toISOString(),
        component: "decisioning",
        action: "NOA_NOT_REQUIRED",
        status: "INFO",
      });
    } else {
      await events.updateState(admission.eventId, "EVALUATED");
    }

    logger.info("Rules evaluated", {
      eventId: admission.eventId,
      correlationId: admission.correlationId,
      decision: decision.decision,
      processingState,
    });

    return { decision, decisionRecord, processingState };
  }
}
