import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ContractSelectionInput,
  ContractVersionRecord,
  DestinationConfig,
  RetryPolicy,
} from "@/src/domain/contracts/contract";
import type {
  ContractRepository,
  DestinationRepository,
  RuleRepository,
  TransformationRepository,
} from "@/src/domain/ports";
import type { RuleVersion } from "@/src/domain/rules/rule";
import type { TransformationDefinition } from "@/src/domain/transformations/transformation";
import type { UUID } from "@/src/domain/types";
import { throwIfError } from "./errors";

export class SupabaseRuleRepository implements RuleRepository {
  constructor(private readonly client: SupabaseClient) {}

  async listActiveVersions(
    asOf: Date,
    _eventType?: string
  ): Promise<RuleVersion[]> {
    void _eventType;
    const asOfIso = asOf.toISOString();
    const { data, error } = await this.client
      .from("rule_versions")
      .select("*, rules!inner(id, name, priority, active)")
      .lte("effective_date", asOfIso);
    throwIfError(error, "rules.listActiveVersions");

    return (data ?? [])
      .filter((row) => {
        const rule = row.rules as {
          active: boolean;
          name: string;
          priority: number;
          id: string;
        };
        if (!rule.active) return false;
        if (row.expiration_date && row.expiration_date <= asOfIso) return false;
        return true;
      })
      .map((row) => {
        const rule = row.rules as {
          active: boolean;
          name: string;
          priority: number;
          id: string;
        };
        return {
          id: row.id,
          ruleId: rule.id,
          name: rule.name,
          version: row.version,
          priority: rule.priority,
          effectiveDate: row.effective_date,
          expirationDate: row.expiration_date,
          conditions: row.conditions,
          actions: row.actions,
        } satisfies RuleVersion;
      });
  }

  async listAll(): Promise<RuleVersion[]> {
    const { data, error } = await this.client
      .from("rule_versions")
      .select("*, rules!inner(id, name, priority, active)");
    throwIfError(error, "rules.listAll");
    return (data ?? []).map((row) => {
      const rule = row.rules as {
        name: string;
        priority: number;
        id: string;
      };
      return {
        id: row.id,
        ruleId: rule.id,
        name: rule.name,
        version: row.version,
        priority: rule.priority,
        effectiveDate: row.effective_date,
        expirationDate: row.expiration_date,
        conditions: row.conditions,
        actions: row.actions,
      };
    });
  }
}

export class SupabaseDestinationRepository implements DestinationRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findById(id: UUID): Promise<DestinationConfig | null> {
    const { data, error } = await this.client
      .from("destinations")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    throwIfError(error, "destinations.findById");
    return data ? mapDestination(data) : null;
  }

  async findByCode(code: string): Promise<DestinationConfig | null> {
    const { data, error } = await this.client
      .from("destinations")
      .select("*")
      .eq("code", code)
      .maybeSingle();
    throwIfError(error, "destinations.findByCode");
    return data ? mapDestination(data) : null;
  }

  async listAll(): Promise<DestinationConfig[]> {
    const { data, error } = await this.client
      .from("destinations")
      .select("*")
      .order("code", { ascending: true });
    throwIfError(error, "destinations.listAll");
    return (data ?? []).map(mapDestination);
  }
}

function mapDestination(row: {
  id: string;
  code: string;
  name: string;
  adapter_key: string;
  endpoint: string | null;
  auth_type: string | null;
  auth_config: Record<string, string> | null;
  active: boolean;
}): DestinationConfig {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    adapterKey: row.adapter_key,
    endpoint: row.endpoint ?? undefined,
    authType: row.auth_type ?? undefined,
    authConfig: row.auth_config ?? undefined,
    active: row.active,
  };
}

export class SupabaseContractRepository implements ContractRepository {
  constructor(private readonly client: SupabaseClient) {}

  async findMatching(
    input: ContractSelectionInput
  ): Promise<ContractVersionRecord[]> {
    const all = await this.listAll();
    const asOfMs = input.asOf.getTime();
    return all.filter((v) => {
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
      if (
        v.payerBrand &&
        input.payer &&
        v.payerBrand.trim().toLowerCase() !== input.payer.trim().toLowerCase()
      ) {
        return false;
      }
      if (v.payerBrand && !input.payer) {
        return false;
      }
      return true;
    });
  }

  async listAll(): Promise<ContractVersionRecord[]> {
    const { data, error } = await this.client
      .from("contract_versions")
      .select("*, contracts!inner(contract_id, name, payer, product, active)");
    throwIfError(error, "contracts.listAll");
    return (data ?? []).map((row) => {
      const header = row.contracts as {
        contract_id: string;
        name: string;
        payer: string | null;
        product: string | null;
        payer_brand?: string | null;
        state_code?: string | null;
        source_type?: string | null;
        active: boolean;
      };
      const profile = (row.profile ?? undefined) as
        | ContractVersionRecord["profile"]
        | undefined;
      return {
        id: row.id,
        contractBusinessId: header.contract_id,
        name: header.name,
        version: row.version,
        payer: header.payer ?? undefined,
        product: header.product ?? undefined,
        payerBrand:
          header.payer_brand ?? profile?.payerBrand ?? undefined,
        planProduct: profile?.planProduct,
        state: header.state_code ?? profile?.state ?? undefined,
        facilityId: profile?.providerFacility,
        network: profile?.network,
        payloadFormat: row.payload_format,
        transport: row.transport,
        destinationId: row.destination_id,
        transformerCode: row.transformer_code,
        acknowledgementType: row.acknowledgement_type,
        retryPolicy: row.retry_policy as RetryPolicy,
        requiredFields: (row.required_fields as string[]) ?? [],
        effectiveDate: row.effective_date,
        expirationDate: row.expiration_date,
        active: header.active,
        profile,
      };
    });
  }
}

export class SupabaseTransformationRepository
  implements TransformationRepository
{
  constructor(private readonly client: SupabaseClient) {}

  async findByCodeVersion(
    code: string,
    version?: number
  ): Promise<TransformationDefinition | null> {
    let query = this.client
      .from("transformation_versions")
      .select("*, transformations!inner(code, active)")
      .eq("transformations.code", code)
      .eq("transformations.active", true);

    if (version != null) {
      query = query.eq("version", version);
    } else {
      query = query.order("version", { ascending: false }).limit(1);
    }

    const { data, error } = await query.maybeSingle();
    throwIfError(error, "transformations.findByCodeVersion");
    if (!data) return null;
    const header = data.transformations as { code: string };
    return {
      id: data.id,
      code: header.code,
      version: data.version,
      sourceModel: data.source_model,
      targetFormat: data.target_format,
      mappings: data.mappings,
    };
  }

  async listAll(): Promise<TransformationDefinition[]> {
    const { data, error } = await this.client
      .from("transformation_versions")
      .select("*, transformations!inner(code, active)")
      .order("version", { ascending: true });
    throwIfError(error, "transformations.listAll");
    return (data ?? []).map((row) => {
      const header = row.transformations as { code: string };
      return {
        id: row.id,
        code: header.code,
        version: row.version,
        sourceModel: row.source_model,
        targetFormat: row.target_format,
        mappings: row.mappings,
      };
    });
  }
}
