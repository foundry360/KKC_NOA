import type { DecisionRecord } from "@/src/domain/decisions/decision";
import type { DecisionRepository } from "@/src/domain/ports";
import type { UUID } from "@/src/domain/types";

export class InMemoryDecisionRepository implements DecisionRepository {
  private readonly byEventId = new Map<UUID, DecisionRecord>();

  async save(decision: DecisionRecord): Promise<void> {
    this.byEventId.set(decision.eventId, structuredClone(decision));
  }

  async findByEventId(eventId: UUID): Promise<DecisionRecord | null> {
    const found = this.byEventId.get(eventId);
    return found ? structuredClone(found) : null;
  }

  clear(): void {
    this.byEventId.clear();
  }
}
