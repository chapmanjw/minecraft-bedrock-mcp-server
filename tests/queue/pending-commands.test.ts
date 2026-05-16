import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createPendingCommands } from "../../src/queue/pending-commands.js";
import { BridgeError } from "../../src/errors/bridge-error.js";
import type { CommandResult } from "../../src/protocol/result.js";

function okResult(id: string): CommandResult {
  return { id, status: "ok", result: { done: true } };
}

describe("pending commands", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves a registered command when it is settled", async () => {
    const pending = createPendingCommands();
    const promise = pending.register("cmd_a", Date.now() + 10_000);
    expect(pending.size()).toBe(1);

    expect(pending.settle("cmd_a", okResult("cmd_a"))).toBe(true);
    await expect(promise).resolves.toEqual(okResult("cmd_a"));
    expect(pending.size()).toBe(0);
  });

  it("rejects with COMMAND_TIMEOUT when the deadline elapses", async () => {
    const pending = createPendingCommands();
    const promise = pending.register("cmd_a", Date.now() + 5_000);
    const assertion = expect(promise).rejects.toMatchObject({ code: "COMMAND_TIMEOUT" });

    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
    expect(pending.size()).toBe(0);
  });

  it("reports settling an unknown id as false", () => {
    const pending = createPendingCommands();
    expect(pending.settle("cmd_missing", okResult("cmd_missing"))).toBe(false);
  });

  it("does not time out a command that was already settled", async () => {
    const pending = createPendingCommands();
    const promise = pending.register("cmd_a", Date.now() + 5_000);
    pending.settle("cmd_a", okResult("cmd_a"));

    await vi.advanceTimersByTimeAsync(10_000);
    await expect(promise).resolves.toEqual(okResult("cmd_a"));
  });

  it("rejects every pending command on rejectAll", async () => {
    const pending = createPendingCommands();
    const first = pending.register("cmd_a", Date.now() + 10_000);
    const second = pending.register("cmd_b", Date.now() + 10_000);
    const firstAssertion = expect(first).rejects.toMatchObject({ code: "BRIDGE_DISCONNECTED" });
    const secondAssertion = expect(second).rejects.toMatchObject({ code: "BRIDGE_DISCONNECTED" });

    pending.rejectAll(new BridgeError({ code: "BRIDGE_DISCONNECTED", message: "shutting down" }));

    await firstAssertion;
    await secondAssertion;
    expect(pending.size()).toBe(0);
  });
});
