import { describe, expect, it } from "vitest";
import { PROCESSING_STATES } from "@/src/domain/types";

describe("ProcessingState", () => {
  it("includes primary lifecycle and exception states", () => {
    for (const state of [
      "RECEIVED",
      "VALIDATED",
      "NORMALIZED",
      "EVALUATED",
      "ROUTED",
      "TRANSFORMED",
      "DELIVERED",
      "ACKNOWLEDGED",
      "VALIDATION_FAILED",
      "DEAD_LETTER",
    ] as const) {
      expect(PROCESSING_STATES).toContain(state);
    }
  });
});
