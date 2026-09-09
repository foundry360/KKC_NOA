import { describe, expect, it } from "vitest";
import { FixedClock } from "@/src/utils/clock";
import {
  DefaultIdGenerator,
  SequentialIdGenerator,
} from "@/src/utils/id-generator";

describe("IdGenerator", () => {
  const clock = new FixedClock(new Date("2026-09-09T18:00:00.000Z"));

  it("SequentialIdGenerator produces NOA-YYYYMMDD-###### correlation IDs", () => {
    const ids = new SequentialIdGenerator(clock);
    expect(ids.correlationId()).toBe("NOA-20260909-000001");
    expect(ids.correlationId()).toBe("NOA-20260909-000002");
    expect(ids.correlationId("EVT")).toBe("EVT-20260909-000003");
  });

  it("SequentialIdGenerator produces stable UUID-shaped event IDs", () => {
    const ids = new SequentialIdGenerator(clock);
    expect(ids.eventId()).toBe("00000000-0000-4000-8000-000000000001");
    expect(ids.eventId()).toBe("00000000-0000-4000-8000-000000000002");
  });

  it("DefaultIdGenerator correlation IDs match the NOA date pattern", () => {
    const ids = new DefaultIdGenerator(clock, () => "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    const correlationId = ids.correlationId();
    expect(correlationId).toMatch(/^NOA-20260909-\d{6}$/);
    expect(ids.eventId()).toBe("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
  });
});
