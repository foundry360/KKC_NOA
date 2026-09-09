import { describe, expect, it } from "vitest";
import { MemoryLogger, sanitizeMeta } from "@/src/utils/logger";

describe("Logger", () => {
  it("MemoryLogger records levels and meta", () => {
    const logger = new MemoryLogger();
    logger.info("received", { eventId: "e1", correlationId: "NOA-20260909-000001" });
    logger.warn("retry", { attempt: 2 });
    logger.error("failed", { code: "DELIVERY_FAILED" });

    expect(logger.entries).toHaveLength(3);
    expect(logger.entries[0]?.level).toBe("info");
    expect(logger.entries[2]?.meta).toEqual({ code: "DELIVERY_FAILED" });
  });

  it("sanitizeMeta redacts PHI-like keys", () => {
    const sanitized = sanitizeMeta({
      eventId: "e1",
      patientName: "SYNTHETIC ADA",
      mrn: "MRN-1",
      correlationId: "NOA-20260909-000001",
    });

    expect(sanitized.eventId).toBe("e1");
    expect(sanitized.correlationId).toBe("NOA-20260909-000001");
    expect(sanitized.patientName).toBe("[REDACTED]");
    expect(sanitized.mrn).toBe("[REDACTED]");
  });
});
