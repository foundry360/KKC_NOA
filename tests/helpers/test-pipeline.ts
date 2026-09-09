import type { Clock, Logger } from "@/src/domain/ports";
import {
  InMemoryAdmissionEventRepository,
  InMemoryAuditPort,
  InMemoryDecisionRepository,
  InMemoryEventRepository,
  InMemoryRuleExecutionRepository,
  InMemoryRuleRepository,
} from "@/src/infrastructure/memory";
import {
  InMemoryContractRepository,
  InMemoryDestinationRepository,
  InMemoryTransformationRepository,
} from "@/src/infrastructure/memory/contract-repositories";
import {
  InMemoryDeadLetterRepository,
  InMemoryDeliveryAttemptRepository,
  InMemoryNotificationRepository,
} from "@/src/infrastructure/memory/delivery-repositories";
import { InMemoryRoutingSelectionRepository } from "@/src/infrastructure/memory/routing-selection-repository";
import { InMemoryTransformationResultRepository } from "@/src/infrastructure/memory/transformation-result-repository";
import {
  DEFAULT_NOA_CONTRACT_BUSINESS_ID,
  SEED_CONTRACTS,
  SEED_DESTINATIONS,
} from "@/src/infrastructure/seed/contracts";
import { createSeedTransformations } from "@/src/infrastructure/seed/transformations";
import { createSeedRuleVersions } from "@/src/infrastructure/seed/rules";
import { MockDeliveryAdapter } from "@/src/adapters/mock/mock-delivery-adapter";
import { RestDeliveryAdapter } from "@/src/adapters/rest/rest-delivery-adapter";
import { SalesforceDeliveryAdapter } from "@/src/adapters/salesforce/salesforce-delivery-adapter";
import { PegaDeliveryAdapter } from "@/src/adapters/pega/pega-delivery-adapter";
import { DefaultDeliveryAdapterRegistry } from "@/src/adapters/registry";
import { DecisioningService } from "@/src/services/decisioning/decisioning-service";
import { ConfigurableRulesEngine } from "@/src/services/decisioning/rules-engine";
import { DefaultDeliveryService } from "@/src/services/delivery/delivery-service";
import { FhirIngestionService } from "@/src/services/fhir/ingestion-service";
import { AdmissionFhirValidator } from "@/src/services/fhir/validator";
import { AdmissionNormalizationService } from "@/src/services/normalization/normalize-admission";
import { DefaultNoaPipeline } from "@/src/services/pipeline/noa-pipeline";
import { DefaultContractRegistry } from "@/src/services/routing/contract-registry";
import { RoutingService } from "@/src/services/routing/routing-service";
import { SimpleMappingTransformationEngine } from "@/src/services/transformation/mapping-engine";
import { TransformationService } from "@/src/services/transformation/transformation-service";
import { SequentialIdGenerator } from "@/src/utils/id-generator";

export function createTestPipeline(
  clock: Clock,
  logger: Logger,
  options?: { mockAdapter?: MockDeliveryAdapter }
) {
  const events = new InMemoryEventRepository();
  const admissions = new InMemoryAdmissionEventRepository();
  const audit = new InMemoryAuditPort();
  const decisions = new InMemoryDecisionRepository();
  const executions = new InMemoryRuleExecutionRepository();
  const rules = new InMemoryRuleRepository();
  rules.seed(createSeedRuleVersions());

  const destinations = new InMemoryDestinationRepository();
  destinations.seed(SEED_DESTINATIONS);
  const contracts = new InMemoryContractRepository();
  contracts.seed(SEED_CONTRACTS);
  const transformations = new InMemoryTransformationRepository();
  transformations.seed(createSeedTransformations());
  const selections = new InMemoryRoutingSelectionRepository();
  const transformResults = new InMemoryTransformationResultRepository();
  const notifications = new InMemoryNotificationRepository();
  const attempts = new InMemoryDeliveryAttemptRepository();
  const deadLetters = new InMemoryDeadLetterRepository();

  const registry = new DefaultContractRegistry(
    contracts,
    destinations,
    transformations,
    DEFAULT_NOA_CONTRACT_BUSINESS_ID
  );

  const routing = new RoutingService({
    clock,
    logger,
    registry,
    events,
    selections,
    audit,
  });

  const transformation = new TransformationService({
    clock,
    logger,
    engine: new SimpleMappingTransformationEngine(),
    events,
    results: transformResults,
    audit,
  });

  const mockAdapter = options?.mockAdapter ?? new MockDeliveryAdapter();
  const adapters = new DefaultDeliveryAdapterRegistry();
  adapters.register(mockAdapter);
  adapters.register(new RestDeliveryAdapter());
  adapters.register(new SalesforceDeliveryAdapter(mockAdapter));
  adapters.register(new PegaDeliveryAdapter(mockAdapter));

  const delivery = new DefaultDeliveryService({
    clock,
    logger,
    adapters,
    events,
    notifications,
    attempts,
    deadLetters,
    audit,
  });

  const pipeline = new DefaultNoaPipeline(
    new FhirIngestionService({
      ids: new SequentialIdGenerator(clock),
      clock,
      logger,
      events,
      admissions,
      audit,
      validator: new AdmissionFhirValidator(),
      normalizer: new AdmissionNormalizationService(),
    }),
    new DecisioningService({
      clock,
      logger,
      rulesEngine: new ConfigurableRulesEngine(rules),
      events,
      decisions,
      executions,
      audit,
    }),
    routing,
    transformation,
    delivery
  );

  return {
    pipeline,
    events,
    admissions,
    audit,
    decisions,
    selections,
    transformResults,
    notifications,
    attempts,
    deadLetters,
    mockAdapter,
    destinations,
    contracts,
    delivery,
  };
}
