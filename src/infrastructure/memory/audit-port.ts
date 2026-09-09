import type { AuditEntry } from "@/src/domain/delivery/audit";
import type { AuditPort } from "@/src/domain/ports";
import type { CorrelationId } from "@/src/domain/types";
import { randomUUID } from "node:crypto";

export class InMemoryAuditPort implements AuditPort {
  readonly entries: AuditEntry[] = [];

  async record(entry: AuditEntry): Promise<void> {
    this.entries.push({
      ...entry,
      id: entry.id ?? randomUUID(),
    });
  }

  async listByCorrelationId(correlationId: CorrelationId): Promise<AuditEntry[]> {
    return this.entries
      .filter((e) => e.correlationId === correlationId)
      .sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  async listRecent(limit: number): Promise<AuditEntry[]> {
    return [...this.entries]
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  clear(): void {
    this.entries.length = 0;
  }
}
