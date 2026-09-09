import type { ContractVersionRecord, DestinationConfig } from "../contracts/contract";
import type { TransformationDefinition } from "../transformations/transformation";

export interface RoutingResult {
  destination: DestinationConfig;
  contractVersion: ContractVersionRecord;
  transformation: TransformationDefinition;
  adapterKey: string;
}

export interface EvaluationContext {
  asOf?: Date;
}
