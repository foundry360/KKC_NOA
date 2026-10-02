import type {
  ContractSelectionInput,
  ContractVersionRecord,
} from "@/src/domain/contracts/contract";

function norm(value?: string): string | undefined {
  return value?.trim().toLowerCase() || undefined;
}

function brandEquals(configured?: string, input?: string): boolean {
  const a = norm(configured);
  const b = norm(input);
  if (!a || !b) return false;
  return a === b;
}

/**
 * Specificity score for contract matching.
 *
 * Precedence (higher wins):
 *   facility > network > state > plan/product > payer brand > payer type > default
 *
 * Dimensions left unset on a contract are wildcards (do not filter; do not add score).
 * Returns null when the contract does not match the input.
 */
export function scoreContractMatch(
  contract: ContractVersionRecord,
  input: ContractSelectionInput
): number | null {
  if (input.contractBusinessId) {
    return contract.contractBusinessId === input.contractBusinessId ? 1000 : null;
  }

  if (contract.payer && input.payerType && contract.payer !== input.payerType) {
    return null;
  }

  if (contract.product && input.product && contract.product !== input.product) {
    return null;
  }

  if (contract.payerBrand) {
    if (!brandEquals(contract.payerBrand, input.payer)) return null;
  }

  // Optional dimensions: only constrain when the input supplies them.
  // Brand baselines still apply when plan/state/facility are absent on the event.
  if (contract.planProduct && input.planProduct) {
    if (norm(contract.planProduct) !== norm(input.planProduct)) return null;
  }

  if (contract.state && input.state) {
    if (norm(contract.state) !== norm(input.state)) return null;
  }

  if (contract.network && input.network) {
    if (norm(contract.network) !== norm(input.network)) return null;
  }

  if (contract.facilityId && input.facilityId) {
    if (contract.facilityId !== input.facilityId) return null;
  }

  let score = 0;
  if (contract.payer) score += 1;
  if (contract.payerBrand && brandEquals(contract.payerBrand, input.payer)) {
    score += 2;
  }
  if (contract.planProduct && input.planProduct) score += 4;
  if (contract.state && input.state) score += 8;
  if (contract.network && input.network) score += 16;
  if (contract.facilityId && input.facilityId) score += 32;
  return score;
}

export function selectMostSpecificContracts(
  matches: ContractVersionRecord[],
  input: ContractSelectionInput
): { selected: ContractVersionRecord[]; conflict: boolean; maxScore: number } {
  const scored = matches
    .map((c) => ({ contract: c, score: scoreContractMatch(c, input) }))
    .filter((x): x is { contract: ContractVersionRecord; score: number } => x.score !== null);

  if (scored.length === 0) {
    return { selected: [], conflict: false, maxScore: -1 };
  }

  const maxScore = Math.max(...scored.map((s) => s.score));
  const top = scored.filter((s) => s.score === maxScore).map((s) => s.contract);

  // Same specificity + different business ids / transformers => conflict
  // (except Medicare multi-destination rows resolved by registry preference).
  const distinctIds = new Set(top.map((c) => c.contractBusinessId));
  const conflict =
    distinctIds.size > 1 &&
    !top.every((c) => c.payerBrand == null && c.payer === "MEDICARE");

  return { selected: top, conflict, maxScore };
}
