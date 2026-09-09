import type { AdmissionEvent } from "@/src/domain/admission/admission-event";
import type { AdmissionEventRepository } from "@/src/domain/ports";
import type { UUID } from "@/src/domain/types";

export class InMemoryAdmissionEventRepository implements AdmissionEventRepository {
  private readonly byEventId = new Map<UUID, AdmissionEvent>();

  async save(admission: AdmissionEvent): Promise<void> {
    this.byEventId.set(admission.eventId, structuredClone(admission));
  }

  async findByEventId(eventId: UUID): Promise<AdmissionEvent | null> {
    const found = this.byEventId.get(eventId);
    return found ? structuredClone(found) : null;
  }

  clear(): void {
    this.byEventId.clear();
  }
}
