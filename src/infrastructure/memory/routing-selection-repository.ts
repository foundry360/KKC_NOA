import type { RoutingSelectionRecord, RoutingSelectionRepository } from "@/src/services/routing/routing-service";
import type { UUID } from "@/src/domain/types";

export class InMemoryRoutingSelectionRepository
  implements RoutingSelectionRepository
{
  private readonly byEventId = new Map<UUID, RoutingSelectionRecord>();

  async save(selection: RoutingSelectionRecord): Promise<void> {
    this.byEventId.set(selection.eventId, structuredClone(selection));
  }

  async findByEventId(eventId: UUID): Promise<RoutingSelectionRecord | null> {
    const found = this.byEventId.get(eventId);
    return found ? structuredClone(found) : null;
  }

  clear(): void {
    this.byEventId.clear();
  }
}
