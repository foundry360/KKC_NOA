import type { RuleVersion } from "@/src/domain/rules/rule";
import type { RuleRepository } from "@/src/domain/ports";

export class InMemoryRuleRepository implements RuleRepository {
  private versions: RuleVersion[] = [];

  seed(versions: RuleVersion[]): void {
    this.versions = versions.map((v) => structuredClone(v));
  }

  async listActiveVersions(
    asOf: Date,
    eventType?: string
  ): Promise<RuleVersion[]> {
    const asOfMs = asOf.getTime();
    return this.versions
      .filter((v) => {
        const effective = Date.parse(v.effectiveDate);
        if (Number.isNaN(effective) || effective > asOfMs) return false;
        if (v.expirationDate) {
          const exp = Date.parse(v.expirationDate);
          if (!Number.isNaN(exp) && exp <= asOfMs) return false;
        }
        if (eventType) {
          // Optional filter: if conditions require eventType, still return all;
          // engine evaluates conditions. Keep all active for POC.
          void eventType;
        }
        return true;
      })
      .map((v) => structuredClone(v));
  }

  async listAll(): Promise<RuleVersion[]> {
    return this.versions.map((v) => structuredClone(v));
  }

  clear(): void {
    this.versions = [];
  }
}
