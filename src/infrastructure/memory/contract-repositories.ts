import type {
  ContractSelectionInput,
  ContractVersionRecord,
  DestinationConfig,
} from "@/src/domain/contracts/contract";
import type {
  ContractRepository,
  DestinationRepository,
  TransformationRepository,
} from "@/src/domain/ports";
import type { UUID } from "@/src/domain/types";
import type { TransformationDefinition } from "@/src/domain/transformations/transformation";

export class InMemoryDestinationRepository implements DestinationRepository {
  private readonly byId = new Map<UUID, DestinationConfig>();
  private readonly byCode = new Map<string, DestinationConfig>();

  seed(destinations: DestinationConfig[]): void {
    this.clear();
    for (const dest of destinations) {
      this.byId.set(dest.id, structuredClone(dest));
      this.byCode.set(dest.code, structuredClone(dest));
    }
  }

  async findById(id: UUID): Promise<DestinationConfig | null> {
    const found = this.byId.get(id);
    return found ? structuredClone(found) : null;
  }

  async findByCode(code: string): Promise<DestinationConfig | null> {
    const found = this.byCode.get(code);
    return found ? structuredClone(found) : null;
  }

  async listAll(): Promise<DestinationConfig[]> {
    return Array.from(this.byId.values()).map((d) => structuredClone(d));
  }

  clear(): void {
    this.byId.clear();
    this.byCode.clear();
  }
}

export class InMemoryContractRepository implements ContractRepository {
  private versions: ContractVersionRecord[] = [];

  seed(versions: ContractVersionRecord[]): void {
    this.versions = versions.map((v) => structuredClone(v));
  }

  async findMatching(
    input: ContractSelectionInput
  ): Promise<ContractVersionRecord[]> {
    const asOfMs = input.asOf.getTime();

    return this.versions
      .filter((v) => {
        if (!v.active) return false;
        const effective = Date.parse(v.effectiveDate);
        if (Number.isNaN(effective) || effective > asOfMs) return false;
        if (v.expirationDate) {
          const exp = Date.parse(v.expirationDate);
          if (!Number.isNaN(exp) && exp <= asOfMs) return false;
        }
        if (input.contractBusinessId) {
          return v.contractBusinessId === input.contractBusinessId;
        }
        if (input.payerType && v.payer && v.payer !== input.payerType) {
          return false;
        }
        if (input.product && v.product && v.product !== input.product) {
          return false;
        }
        return true;
      })
      .map((v) => structuredClone(v));
  }

  async listAll(): Promise<ContractVersionRecord[]> {
    return this.versions.map((v) => structuredClone(v));
  }

  clear(): void {
    this.versions = [];
  }
}

export class InMemoryTransformationRepository implements TransformationRepository {
  private readonly byCode = new Map<string, TransformationDefinition[]>();

  seed(definitions: TransformationDefinition[]): void {
    this.byCode.clear();
    for (const def of definitions) {
      const list = this.byCode.get(def.code) ?? [];
      list.push(structuredClone(def));
      this.byCode.set(def.code, list);
    }
  }

  async findByCodeVersion(
    code: string,
    version?: number
  ): Promise<TransformationDefinition | null> {
    const list = this.byCode.get(code) ?? [];
    if (list.length === 0) return null;
    if (version != null) {
      return structuredClone(list.find((d) => d.version === version) ?? null);
    }
    const latest = [...list].sort((a, b) => b.version - a.version)[0];
    return latest ? structuredClone(latest) : null;
  }

  async listAll(): Promise<TransformationDefinition[]> {
    return Array.from(this.byCode.values())
      .flat()
      .map((d) => structuredClone(d));
  }

  clear(): void {
    this.byCode.clear();
  }
}
