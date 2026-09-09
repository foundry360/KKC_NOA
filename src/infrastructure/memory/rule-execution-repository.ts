import type {
  RuleExecutionRecord,
  RuleExecutionRepository,
} from "@/src/services/decisioning/decisioning-service";
import type { UUID } from "@/src/domain/types";

export class InMemoryRuleExecutionRepository implements RuleExecutionRepository {
  private readonly byEventId = new Map<UUID, RuleExecutionRecord>();

  async save(execution: RuleExecutionRecord): Promise<void> {
    this.byEventId.set(execution.eventId, structuredClone(execution));
  }

  async findByEventId(eventId: UUID): Promise<RuleExecutionRecord | null> {
    const found = this.byEventId.get(eventId);
    return found ? structuredClone(found) : null;
  }

  clear(): void {
    this.byEventId.clear();
  }
}
