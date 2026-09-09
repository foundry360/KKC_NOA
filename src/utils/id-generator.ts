import { randomUUID } from "node:crypto";
import type { Clock, IdGenerator } from "@/src/domain/ports";
import type { CorrelationId, UUID } from "@/src/domain/types";

function padSequence(n: number, width = 6): string {
  return String(n).padStart(width, "0");
}

function formatDateUTC(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/**
 * Generates UUIDs for events and human-readable correlation IDs:
 * `NOA-YYYYMMDD-######`
 */
export class DefaultIdGenerator implements IdGenerator {
  private sequence = 0;

  constructor(
    private readonly clock: Clock,
    private readonly random: () => UUID = () => randomUUID()
  ) {}

  eventId(): UUID {
    return this.random();
  }

  correlationId(prefix = "NOA"): CorrelationId {
    this.sequence = (this.sequence + 1) % 1_000_000;
    const datePart = formatDateUTC(this.clock.now());
    // Mix sequence with low-order entropy so concurrent instances rarely collide in POC
    const entropy = Math.floor(Math.random() * 1000);
    const seq = (this.sequence * 1000 + entropy) % 1_000_000;
    return `${prefix}-${datePart}-${padSequence(seq)}`;
  }
}

/** Deterministic ID generator for tests. */
export class SequentialIdGenerator implements IdGenerator {
  private eventCounter = 0;
  private correlationCounter = 0;

  constructor(private readonly clock: Clock) {}

  eventId(): UUID {
    this.eventCounter += 1;
    return `00000000-0000-4000-8000-${String(this.eventCounter).padStart(12, "0")}`;
  }

  correlationId(prefix = "NOA"): CorrelationId {
    this.correlationCounter += 1;
    const datePart = formatDateUTC(this.clock.now());
    return `${prefix}-${datePart}-${padSequence(this.correlationCounter)}`;
  }
}
