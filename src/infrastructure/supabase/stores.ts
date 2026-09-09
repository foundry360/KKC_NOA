import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionRecord } from "@/src/domain/decisions/decision";
import type { DeadLetterRecord } from "@/src/domain/delivery/audit";
import type { NotificationRecord } from "@/src/domain/delivery/delivery";
import type {
  ContractVersionRecord,
  DestinationConfig,
} from "@/src/domain/contracts/contract";
import type {
  AdmissionEventRepository,
  AuditPort,
  DeadLetterRepository,
  DecisionRepository,
  DeliveryAttemptRepository,
  EventRepository,
  NotificationRepository,
  RuleRepository,
  ContractRepository,
  DestinationRepository,
  TransformationRepository,
} from "@/src/domain/ports";
import type { RuleVersion } from "@/src/domain/rules/rule";
import type { TransformationDefinition } from "@/src/domain/transformations/transformation";
import type {
  RuleExecutionRepository,
} from "@/src/services/decisioning/decisioning-service";
import type {
  RoutingSelectionRepository,
} from "@/src/services/routing/routing-service";
import type {
  TransformationResultRepository,
} from "@/src/services/transformation/transformation-service";
import {
  SupabaseContractRepository,
  SupabaseDestinationRepository,
  SupabaseRuleRepository,
  SupabaseTransformationRepository,
} from "./config-repos";
import { ensureSupabaseConfigSeed } from "./seed-config";
import {
  SupabaseAdmissionEventRepository,
  SupabaseAuditPort,
  SupabaseDeadLetterRepository,
  SupabaseDecisionRepository,
  SupabaseDeliveryAttemptRepository,
  SupabaseEventRepository,
  SupabaseNotificationRepository,
  SupabaseRoutingSelectionRepository,
  SupabaseRuleExecutionRepository,
  SupabaseTransformationResultRepository,
} from "./transactional-repos";

export type NotificationStore = NotificationRepository & {
  listAll(): Promise<NotificationRecord[]>;
};

export type DeadLetterStore = DeadLetterRepository & {
  listAll(): Promise<DeadLetterRecord[]>;
};

export type RuleStore = RuleRepository & {
  listAll(): Promise<RuleVersion[]>;
};

export type DestinationStore = DestinationRepository & {
  listAll(): Promise<DestinationConfig[]>;
};

export type ContractStore = ContractRepository & {
  listAll(): Promise<ContractVersionRecord[]>;
};

export type TransformationStore = TransformationRepository & {
  listAll(): Promise<TransformationDefinition[]>;
};

export type DecisionStore = DecisionRepository & {
  findByEventId(eventId: string): Promise<DecisionRecord | null>;
};

export type RuntimeStores = {
  events: EventRepository;
  admissions: AdmissionEventRepository;
  audit: AuditPort;
  decisions: DecisionStore;
  executions: RuleExecutionRepository;
  rules: RuleStore;
  contracts: ContractStore;
  destinations: DestinationStore;
  transformations: TransformationStore;
  selections: RoutingSelectionRepository;
  transformResults: TransformationResultRepository;
  notifications: NotificationStore;
  attempts: DeliveryAttemptRepository;
  deadLetters: DeadLetterStore;
};

export async function createSupabaseStores(
  client: SupabaseClient
): Promise<RuntimeStores> {
  await ensureSupabaseConfigSeed(client);

  return {
    events: new SupabaseEventRepository(client),
    admissions: new SupabaseAdmissionEventRepository(client),
    audit: new SupabaseAuditPort(client),
    decisions: new SupabaseDecisionRepository(client),
    executions: new SupabaseRuleExecutionRepository(client),
    rules: new SupabaseRuleRepository(client),
    contracts: new SupabaseContractRepository(client),
    destinations: new SupabaseDestinationRepository(client),
    transformations: new SupabaseTransformationRepository(client),
    selections: new SupabaseRoutingSelectionRepository(client),
    transformResults: new SupabaseTransformationResultRepository(client),
    notifications: new SupabaseNotificationRepository(client),
    attempts: new SupabaseDeliveryAttemptRepository(client),
    deadLetters: new SupabaseDeadLetterRepository(client),
  };
}
