import type { SupabaseClient } from "@supabase/supabase-js";
import {
  SEED_CONTRACTS,
  SEED_DESTINATIONS,
} from "@/src/infrastructure/seed/contracts";
import { createSeedRuleVersions } from "@/src/infrastructure/seed/rules";
import { createSeedTransformations } from "@/src/infrastructure/seed/transformations";
import { throwIfError } from "./errors";

/** Stable parent UUIDs for contract header rows (versions keep seed version ids). */
const CONTRACT_PARENT_IDS: Record<string, string> = {
  MEDICARE_NOA_MOCK_V1: "44444444-4444-4444-8444-444444444010",
  MEDICARE_NOA_SF_V1: "44444444-4444-4444-8444-444444444020",
  MEDICARE_NOA_PEGA_V1: "44444444-4444-4444-8444-444444444030",
  COMMERCIAL_NOA_MOCK_V1: "44444444-4444-4444-8444-444444444040",
  MEDICAID_NOA_MOCK_V1: "44444444-4444-4444-8444-444444444050",
};

/** Stable parent UUIDs for transformation header rows. */
const TRANSFORM_PARENT_IDS: Record<string, string> = {
  MEDICARE_NOA_MOCK_TRANSFORM: "33333333-3333-4333-8333-333333333010",
  MEDICARE_NOA_SF_TRANSFORM: "33333333-3333-4333-8333-333333333020",
  MEDICARE_NOA_PEGA_TRANSFORM: "33333333-3333-4333-8333-333333333030",
};

/**
 * Upserts POC config (source systems, rules, destinations, contracts, transforms)
 * so transactional FKs resolve when the pipeline persists to Supabase.
 */
export async function ensureSupabaseConfigSeed(
  client: SupabaseClient
): Promise<void> {
  {
    const { error } = await client.from("source_systems").upsert(
      [
        {
          code: "SYNTHETIC_EHR",
          name: "Synthetic EHR (POC)",
          active: true,
        },
        {
          code: "MERIDIAN_CLINICAL",
          name: "Meridian Clinical (Mock EHR)",
          active: true,
        },
      ],
      { onConflict: "code" }
    );
    throwIfError(error, "seed source_systems");
  }

  const ruleVersions = createSeedRuleVersions();
  for (const version of ruleVersions) {
    const { error: ruleError } = await client.from("rules").upsert(
      {
        id: version.ruleId,
        name: version.name,
        description: version.name,
        priority: version.priority,
        active: true,
      },
      { onConflict: "id" }
    );
    throwIfError(ruleError, `seed rule ${version.name}`);

    const { error: versionError } = await client.from("rule_versions").upsert(
      {
        id: version.id,
        rule_id: version.ruleId,
        version: version.version,
        effective_date: version.effectiveDate,
        expiration_date: version.expirationDate,
        conditions: version.conditions,
        actions: version.actions,
      },
      { onConflict: "id" }
    );
    throwIfError(versionError, `seed rule_version ${version.id}`);
  }

  for (const dest of SEED_DESTINATIONS) {
    const { error } = await client.from("destinations").upsert(
      {
        id: dest.id,
        code: dest.code,
        name: dest.name,
        adapter_key: dest.adapterKey,
        endpoint: dest.endpoint ?? null,
        auth_type: dest.authType ?? null,
        auth_config: dest.authConfig ?? null,
        active: dest.active,
      },
      { onConflict: "id" }
    );
    throwIfError(error, `seed destination ${dest.code}`);
  }

  for (const contract of SEED_CONTRACTS) {
    const parentId =
      CONTRACT_PARENT_IDS[contract.contractBusinessId] ?? contract.id;
    const { error: headerError } = await client.from("contracts").upsert(
      {
        id: parentId,
        contract_id: contract.contractBusinessId,
        name: contract.name,
        payer: contract.payer ?? null,
        product: contract.product ?? null,
        active: contract.active,
      },
      { onConflict: "id" }
    );
    throwIfError(headerError, `seed contract ${contract.contractBusinessId}`);

    const { error: versionError } = await client.from("contract_versions").upsert(
      {
        id: contract.id,
        contract_id: parentId,
        version: contract.version,
        effective_date: contract.effectiveDate,
        expiration_date: contract.expirationDate,
        payload_format: contract.payloadFormat,
        transport: contract.transport,
        destination_id: contract.destinationId,
        transformer_code: contract.transformerCode,
        acknowledgement_type: contract.acknowledgementType,
        retry_policy: contract.retryPolicy,
        required_fields: contract.requiredFields,
      },
      { onConflict: "id" }
    );
    throwIfError(versionError, `seed contract_version ${contract.id}`);
  }

  for (const def of createSeedTransformations()) {
    const parentId = TRANSFORM_PARENT_IDS[def.code] ?? def.id;
    const { error: headerError } = await client.from("transformations").upsert(
      {
        id: parentId,
        code: def.code,
        name: def.code,
        active: true,
      },
      { onConflict: "id" }
    );
    throwIfError(headerError, `seed transformation ${def.code}`);

    const { error: versionError } = await client
      .from("transformation_versions")
      .upsert(
        {
          id: def.id,
          transformation_id: parentId,
          version: def.version,
          source_model: def.sourceModel,
          target_format: def.targetFormat,
          mappings: def.mappings,
        },
        { onConflict: "id" }
      );
    throwIfError(versionError, `seed transformation_version ${def.id}`);
  }
}

export { CONTRACT_PARENT_IDS, TRANSFORM_PARENT_IDS };
