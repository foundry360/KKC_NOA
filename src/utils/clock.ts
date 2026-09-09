import type { Clock } from "@/src/domain/ports";

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }
}

/** Fixed clock for deterministic tests. */
export class FixedClock implements Clock {
  constructor(private readonly instant: Date) {}

  now(): Date {
    return new Date(this.instant.getTime());
  }
}
