import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { Decision } from "@/src/domain/decisions/decision";
import type {
  AuditPort,
  Clock,
  ContractRegistry,
  EventRepository,
  Logger,
  RoutingEngine,
} from "@/src/domain/ports";
import type { RoutingResult } from "@/src/domain/routing/routing";
import type { ProcessingState, UUID } from "@/src/domain/types";

export interface RoutingSelectionRecord {
  id: UUID;
  eventId: UUID;
  correlationId: string;
  contractBusinessId: string;
  contractVersionId: string;
  destinationCode: string;
  adapterKey: string;
  transformerCode: string;
  createdAt: string;
  routing: RoutingResult;
}

export interface RoutingSelectionRepository {
  save(selection: RoutingSelectionRecord): Promise<void>;
  findByEventId(eventId: UUID): Promise<RoutingSelectionRecord | null>;
}

export interface RoutingServiceResult {
  processingState: ProcessingState;
  routing?: RoutingResult;
  selection?: RoutingSelectionRecord;
}

/**
 * Answers "where should this notification go?" after SEND_NOA.
 * Separate from transformation and delivery.
 */
export class RoutingService implements RoutingEngine {
  constructor(
    private readonly deps: {
      clock: Clock;
      logger: Logger;
      registry: ContractRegistry;
      events: EventRepository;
      selections: RoutingSelectionRepository;
      audit: AuditPort;
      defaultContractBusinessId?: string;
    }
  ) {}

  async route(
    event: AdmissionEvent,
    decision: Decision,
    options?: { contractBusinessId?: string }
  ): Promise<RoutingResult> {
    const result = await this.routeAndPersist(event, decision, options);
    if (!result.routing) {
      throw new Error("NO_CONTRACT");
    }
    return result.routing;
  }

  async routeAndPersist(
    event: AdmissionEvent,
    decision: Decision,
    options?: { contractBusinessId?: string }
  ): Promise<RoutingServiceResult> {
    const { clock, logger, registry, events, selections, audit } = this.deps;

    if (decision.decision !== "SEND_NOA") {
      return { processingState: "EVALUATED" };
    }

    const resolved = await registry.resolve({
      notificationType: decision.notificationType,
      payerType: event.payer.payerType,
      encounterClass: event.encounter.class,
      contractBusinessId: options?.contractBusinessId,
      asOf: new Date(event.eventTimestamp),
    });

    if (!resolved) {
      await events.updateState(event.eventId, "NO_CONTRACT", "NO_CONTRACT");
      await audit.record({
        correlationId: event.correlationId,
        eventId: event.eventId,
        timestamp: clock.now().toISOString(),
        component: "routing",
        action: "CONTRACT_SELECTED",
        status: "FAILURE",
        errorCode: "NO_CONTRACT",
        errorMessage: "No matching contract for decision context",
        detail: {
          payerType: event.payer.payerType,
          notificationType: decision.notificationType,
          contractBusinessId: options?.contractBusinessId,
        },
      });
      logger.warn("No contract matched", {
        eventId: event.eventId,
        correlationId: event.correlationId,
        payerType: event.payer.payerType,
      });
      return { processingState: "NO_CONTRACT" };
    }

    const selection: RoutingSelectionRecord = {
      id: cryptoRandomId(),
      eventId: event.eventId,
      correlationId: event.correlationId,
      contractBusinessId: resolved.contractVersion.contractBusinessId,
      contractVersionId: resolved.contractVersion.id,
      destinationCode: resolved.destination.code,
      adapterKey: resolved.adapterKey,
      transformerCode: resolved.transformation.code,
      createdAt: clock.now().toISOString(),
      routing: resolved,
    };
    await selections.save(selection);

    await events.updateState(event.eventId, "ROUTED");
    await audit.record({
      correlationId: event.correlationId,
      eventId: event.eventId,
      timestamp: clock.now().toISOString(),
      component: "routing",
      action: "CONTRACT_SELECTED",
      status: "SUCCESS",
      detail: {
        contractBusinessId: selection.contractBusinessId,
        destinationCode: selection.destinationCode,
        adapterKey: selection.adapterKey,
        transformerCode: selection.transformerCode,
      },
      references: {
        contractVersionId: selection.contractVersionId,
        destinationId: resolved.destination.id,
      },
    });

    logger.info("Contract selected", {
      eventId: event.eventId,
      correlationId: event.correlationId,
      contractBusinessId: selection.contractBusinessId,
      adapterKey: selection.adapterKey,
    });

    return {
      processingState: "ROUTED",
      routing: resolved,
      selection,
    };
  }
}

function cryptoRandomId(): UUID {
  return globalThis.crypto.randomUUID();
}
