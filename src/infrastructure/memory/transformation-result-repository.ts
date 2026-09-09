import type {
  TransformationRecord,
  TransformationResultRepository,
} from "@/src/services/transformation/transformation-service";
import type { UUID } from "@/src/domain/types";

export class InMemoryTransformationResultRepository
  implements TransformationResultRepository
{
  private readonly byEventId = new Map<UUID, TransformationRecord>();

  async save(record: TransformationRecord): Promise<void> {
    this.byEventId.set(record.eventId, structuredClone(record));
  }

  async findByEventId(eventId: UUID): Promise<TransformationRecord | null> {
    const found = this.byEventId.get(eventId);
    return found ? structuredClone(found) : null;
  }

  clear(): void {
    this.byEventId.clear();
  }
}
