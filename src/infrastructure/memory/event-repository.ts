import type { InboundEvent } from "@/src/domain/events/inbound-event";
import type { EventRepository } from "@/src/domain/ports";
import type { CorrelationId, ProcessingState, UUID } from "@/src/domain/types";

/** In-memory EventRepository for unit tests and local demos without Supabase. */
export class InMemoryEventRepository implements EventRepository {
  private readonly byId = new Map<UUID, InboundEvent>();
  private readonly byCorrelation = new Map<CorrelationId, UUID>();

  async save(event: InboundEvent): Promise<void> {
    this.byId.set(event.id, { ...event });
    this.byCorrelation.set(event.correlationId, event.id);
  }

  async updateState(
    eventId: UUID,
    state: ProcessingState,
    errorSummary?: string
  ): Promise<void> {
    const existing = this.byId.get(eventId);
    if (!existing) {
      throw new Error(`Event not found: ${eventId}`);
    }
    const updated: InboundEvent = {
      ...existing,
      processingState: state,
      errorSummary: errorSummary ?? existing.errorSummary,
      updatedAt: new Date().toISOString(),
    };
    this.byId.set(eventId, updated);
  }

  async findById(eventId: UUID): Promise<InboundEvent | null> {
    return this.byId.get(eventId) ?? null;
  }

  async findByCorrelationId(
    correlationId: CorrelationId
  ): Promise<InboundEvent | null> {
    const id = this.byCorrelation.get(correlationId);
    if (!id) return null;
    return this.findById(id);
  }

  async listRecent(limit: number): Promise<InboundEvent[]> {
    return Array.from(this.byId.values())
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
      .slice(0, limit);
  }

  clear(): void {
    this.byId.clear();
    this.byCorrelation.clear();
  }
}
