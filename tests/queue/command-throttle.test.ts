import { describe, expect, it } from "vitest";
import { createCommandThrottle } from "../../src/queue/command-throttle.js";

/** A controllable clock for deterministic throttle tests. */
function controllableClock(): { now: () => number; advance: (ms: number) => void } {
  let current = 1_000_000;
  return {
    now: () => current,
    advance: (ms) => {
      current += ms;
    },
  };
}

describe("command throttle", () => {
  it("admits up to the burst capacity, then denies", () => {
    const clock = controllableClock();
    const throttle = createCommandThrottle({
      defaultPolicy: { ratePerSecond: 1, burst: 3 },
      now: clock.now,
    });

    expect(throttle.tryAdmit("mc_block_set")).toBeNull();
    expect(throttle.tryAdmit("mc_block_set")).toBeNull();
    expect(throttle.tryAdmit("mc_block_set")).toBeNull();

    const denied = throttle.tryAdmit("mc_block_set");
    expect(denied).not.toBeNull();
    expect(denied?.retryAfterMs).toBeGreaterThan(0);
  });

  it("refills tokens as time passes", () => {
    const clock = controllableClock();
    const throttle = createCommandThrottle({
      defaultPolicy: { ratePerSecond: 2, burst: 1 },
      now: clock.now,
    });

    expect(throttle.tryAdmit("k")).toBeNull();
    expect(throttle.tryAdmit("k")).not.toBeNull();

    clock.advance(500); // 0.5s at 2 tokens/s replenishes one token
    expect(throttle.tryAdmit("k")).toBeNull();
  });

  it("meters each command kind independently", () => {
    const clock = controllableClock();
    const throttle = createCommandThrottle({
      defaultPolicy: { ratePerSecond: 1, burst: 1 },
      now: clock.now,
    });

    expect(throttle.tryAdmit("kind_a")).toBeNull();
    expect(throttle.tryAdmit("kind_a")).not.toBeNull();
    expect(throttle.tryAdmit("kind_b")).toBeNull();
  });

  it("applies per-kind policy overrides", () => {
    const clock = controllableClock();
    const throttle = createCommandThrottle({
      defaultPolicy: { ratePerSecond: 1, burst: 1 },
      perKindPolicy: { mc_run_command: { ratePerSecond: 1, burst: 5 } },
      now: clock.now,
    });

    for (let i = 0; i < 5; i += 1) {
      expect(throttle.tryAdmit("mc_run_command")).toBeNull();
    }
    expect(throttle.tryAdmit("mc_run_command")).not.toBeNull();
  });
});
