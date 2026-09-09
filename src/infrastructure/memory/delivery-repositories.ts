import type {
  DeliveryAttemptRecord,
  NotificationRecord,
} from "@/src/domain/delivery/delivery";
import type { DeadLetterRecord } from "@/src/domain/delivery/audit";
import type {
  DeadLetterRepository,
  DeliveryAttemptRepository,
  NotificationRepository,
} from "@/src/domain/ports";
import type { UUID } from "@/src/domain/types";

export class InMemoryNotificationRepository implements NotificationRepository {
  private readonly byId = new Map<UUID, NotificationRecord>();
  private readonly byEventId = new Map<UUID, NotificationRecord>();

  async save(notification: NotificationRecord): Promise<void> {
    const clone = structuredClone(notification);
    this.byId.set(notification.id, clone);
    this.byEventId.set(notification.eventId, clone);
  }

  async updateStatus(id: UUID, status: string): Promise<void> {
    const existing = this.byId.get(id);
    if (!existing) throw new Error(`Notification not found: ${id}`);
    const updated = {
      ...existing,
      status,
      updatedAt: new Date().toISOString(),
    };
    this.byId.set(id, updated);
    this.byEventId.set(updated.eventId, updated);
  }

  async findByEventId(eventId: UUID): Promise<NotificationRecord | null> {
    const found = this.byEventId.get(eventId);
    return found ? structuredClone(found) : null;
  }

  async listAll(): Promise<NotificationRecord[]> {
    return Array.from(this.byId.values()).map((n) => structuredClone(n));
  }

  clear(): void {
    this.byId.clear();
    this.byEventId.clear();
  }
}

export class InMemoryDeliveryAttemptRepository
  implements DeliveryAttemptRepository
{
  private readonly byNotification = new Map<UUID, DeliveryAttemptRecord[]>();

  async save(attempt: DeliveryAttemptRecord): Promise<void> {
    const list = this.byNotification.get(attempt.notificationId) ?? [];
    list.push(structuredClone(attempt));
    this.byNotification.set(attempt.notificationId, list);
  }

  async listByNotificationId(
    notificationId: UUID
  ): Promise<DeliveryAttemptRecord[]> {
    return (this.byNotification.get(notificationId) ?? []).map((a) =>
      structuredClone(a)
    );
  }

  clear(): void {
    this.byNotification.clear();
  }
}

export class InMemoryDeadLetterRepository implements DeadLetterRepository {
  private readonly items: DeadLetterRecord[] = [];

  async save(entry: DeadLetterRecord): Promise<void> {
    this.items.push(structuredClone(entry));
  }

  async listAll(): Promise<DeadLetterRecord[]> {
    return this.items.map((i) => structuredClone(i));
  }

  clear(): void {
    this.items.length = 0;
  }
}
