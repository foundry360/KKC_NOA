import type { Logger } from "@/src/domain/ports";

/**
 * Structured logger abstraction. Swap for CloudWatch later.
 * Never log PHI — callers must pass IDs only in meta.
 */
export class ConsoleLogger implements Logger {
  constructor(private readonly service = "fhir-noa") {}

  info(message: string, meta?: Record<string, unknown>): void {
    this.write("info", message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write("warn", message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write("error", message, meta);
  }

  private write(
    level: "info" | "warn" | "error",
    message: string,
    meta?: Record<string, unknown>
  ): void {
    const entry = {
      level,
      service: this.service,
      message,
      ...(meta ? { meta: sanitizeMeta(meta) } : {}),
      timestamp: new Date().toISOString(),
    };
    const line = JSON.stringify(entry);
    if (level === "error") {
      console.error(line);
    } else if (level === "warn") {
      console.warn(line);
    } else {
      console.info(line);
    }
  }
}

/** In-memory logger for tests. */
export class MemoryLogger implements Logger {
  readonly entries: Array<{
    level: "info" | "warn" | "error";
    message: string;
    meta?: Record<string, unknown>;
  }> = [];

  info(message: string, meta?: Record<string, unknown>): void {
    this.entries.push({ level: "info", message, meta });
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.entries.push({ level: "warn", message, meta });
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.entries.push({ level: "error", message, meta });
  }
}

const PHI_META_KEYS = new Set([
  "patient",
  "patientName",
  "name",
  "family",
  "given",
  "birthDate",
  "mrn",
  "ssn",
  "subscriberId",
  "rawPayload",
  "bundle",
]);

export function sanitizeMeta(
  meta: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (PHI_META_KEYS.has(key)) {
      out[key] = "[REDACTED]";
      continue;
    }
    out[key] = value;
  }
  return out;
}
