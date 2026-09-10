import type { ContractSelectionInput } from "@/src/domain/contracts/contract";
import type {
  ContractRegistry,
  ContractRepository,
  DestinationRepository,
  TransformationRepository,
} from "@/src/domain/ports";
import type { RoutingResult } from "@/src/domain/routing/routing";
import { DEFAULT_NOA_CONTRACT_BUSINESS_ID } from "@/src/infrastructure/seed/contracts";
import { ConfigurationError } from "@/src/domain/errors/app-error";

/**
 * Resolves contract + destination + transformer from registry configuration.
 * Independent of Salesforce/Pega SDKs.
 */
export class DefaultContractRegistry implements ContractRegistry {
  constructor(
    private readonly contracts: ContractRepository,
    private readonly destinations: DestinationRepository,
    private readonly transformations: TransformationRepository,
    private readonly defaultContractBusinessId = DEFAULT_NOA_CONTRACT_BUSINESS_ID
  ) {}

  async resolve(input: ContractSelectionInput): Promise<RoutingResult | null> {
    let matches = await this.contracts.findMatching(input);

    if (matches.length === 0) {
      return null;
    }

    // When multiple contracts match (e.g. Mock/SF/Pega for Medicare),
    // prefer explicit override, then configured default, then any *MOCK* contract.
    if (!input.contractBusinessId && matches.length > 1) {
      const preferred = matches.find(
        (m) => m.contractBusinessId === this.defaultContractBusinessId
      );
      const mockPreferred = matches.find((m) =>
        m.contractBusinessId.includes("_MOCK_")
      );
      if (preferred) {
        matches = [preferred];
      } else if (mockPreferred) {
        matches = [mockPreferred];
      } else {
        matches = [...matches].sort((a, b) => b.version - a.version);
      }
    } else {
      matches = [...matches].sort((a, b) => b.version - a.version);
    }

    const contractVersion = matches[0];
    if (!contractVersion) return null;

    const destination = await this.destinations.findById(
      contractVersion.destinationId
    );
    if (!destination || !destination.active) {
      throw new ConfigurationError("Contract destination missing or inactive", {
        contractBusinessId: contractVersion.contractBusinessId,
        destinationId: contractVersion.destinationId,
      });
    }

    const transformation = await this.transformations.findByCodeVersion(
      contractVersion.transformerCode
    );
    if (!transformation) {
      throw new ConfigurationError("Contract transformer not found", {
        transformerCode: contractVersion.transformerCode,
      });
    }

    return {
      destination,
      contractVersion,
      transformation,
      adapterKey: destination.adapterKey,
    };
  }
}
