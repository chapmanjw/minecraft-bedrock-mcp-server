import { afterEach, describe, expect, it, vi } from "vitest";
import { newCommandId, newSubscriptionId } from "../../src/queue/command-id.js";
import { CommandIdSchema } from "../../src/protocol/command.js";
import { SubscriptionIdSchema } from "../../src/protocol/event.js";

describe("command id", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("generates command ids that satisfy the protocol schema", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(CommandIdSchema.safeParse(newCommandId()).success).toBe(true);
    }
  });

  it("generates subscription ids that satisfy the protocol schema", () => {
    for (let i = 0; i < 100; i += 1) {
      expect(SubscriptionIdSchema.safeParse(newSubscriptionId()).success).toBe(true);
    }
  });

  it("generates unique ids", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newCommandId()));
    expect(ids.size).toBe(1000);
  });

  it("orders ids by generation time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const earlier = newCommandId();
    vi.setSystemTime(new Date("2026-09-01T00:00:00.000Z"));
    const later = newCommandId();
    expect(earlier < later).toBe(true);
  });
});
