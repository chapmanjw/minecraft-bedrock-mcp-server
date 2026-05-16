import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createCommandQueue,
  type CommandQueue,
  type CommandQueueOptions,
  type EnqueueRequest,
} from "../../src/queue/command-queue.js";
import type { CommandThrottle } from "../../src/queue/command-throttle.js";

const ADMIT_ALL: CommandThrottle = { tryAdmit: () => null };

function makeQueue(overrides: Partial<CommandQueueOptions> = {}): CommandQueue {
  return createCommandQueue({
    throttle: ADMIT_ALL,
    maxOutstanding: 100,
    livenessWindowMs: 60_000,
    ...overrides,
  });
}

function enqueueRequest(overrides: Partial<EnqueueRequest> = {}): EnqueueRequest {
  return {
    kind: "mc_block_set",
    payload: { sample: true },
    correlationId: "corr-1",
    timeoutMs: 15_000,
    ...overrides,
  };
}

/** Holds a promise whose rejection a test intentionally does not assert. */
function ignoreRejection(promise: Promise<unknown>): void {
  void promise.catch(() => undefined);
}

/** Runs one completed long poll so the bridge is considered connected. */
async function markBridgeConnected(queue: CommandQueue): Promise<void> {
  const poll = queue.dequeue({ max: 0, timeoutMs: 1, signal: new AbortController().signal });
  await vi.advanceTimersByTimeAsync(1);
  await poll;
}

describe("command queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects enqueue when no behavior pack is connected", async () => {
    const queue = makeQueue();
    await expect(queue.enqueueAndAwait(enqueueRequest())).rejects.toMatchObject({
      code: "BRIDGE_DISCONNECTED",
    });
  });

  it("delivers an enqueued command to a waiting poll and correlates its result", async () => {
    const queue = makeQueue();
    // Calling dequeue marks the bridge connected synchronously.
    const poll = queue.dequeue({
      max: 10,
      timeoutMs: 30_000,
      signal: new AbortController().signal,
    });
    const resultPromise = queue.enqueueAndAwait(enqueueRequest());

    const commands = await poll;
    expect(commands).toHaveLength(1);
    expect(commands[0]).toMatchObject({ kind: "mc_block_set", payload: { sample: true } });
    expect(commands[0]?.id).toMatch(/^cmd_/);
    expect(commands[0]?.deadline_ms).toBeGreaterThan(0);
    expect(commands[0]?.deadline_ms).toBeLessThanOrEqual(15_000);

    const id = commands[0]?.id ?? "";
    queue.settle({ id, status: "ok", result: { placed: 1 } });
    await expect(resultPromise).resolves.toEqual({ id, status: "ok", result: { placed: 1 } });
  });

  it("returns an empty batch when the long poll times out", async () => {
    const queue = makeQueue();
    const poll = queue.dequeue({
      max: 10,
      timeoutMs: 30_000,
      signal: new AbortController().signal,
    });
    await vi.advanceTimersByTimeAsync(30_000);
    await expect(poll).resolves.toEqual([]);
  });

  it("returns an empty batch when the poll is aborted", async () => {
    const queue = makeQueue();
    const controller = new AbortController();
    const poll = queue.dequeue({ max: 10, timeoutMs: 30_000, signal: controller.signal });
    controller.abort();
    await expect(poll).resolves.toEqual([]);
  });

  it("rejects a command that is never settled with COMMAND_TIMEOUT", async () => {
    const queue = makeQueue();
    await markBridgeConnected(queue);

    const resultPromise = queue.enqueueAndAwait(enqueueRequest({ timeoutMs: 5_000 }));
    const assertion = expect(resultPromise).rejects.toMatchObject({ code: "COMMAND_TIMEOUT" });
    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;

    expect(queue.stats().depth).toBe(0);
  });

  it("rejects throttled command kinds with a retry hint", async () => {
    const throttle: CommandThrottle = { tryAdmit: () => ({ retryAfterMs: 500 }) };
    const queue = makeQueue({ throttle });
    await markBridgeConnected(queue);

    await expect(queue.enqueueAndAwait(enqueueRequest())).rejects.toMatchObject({
      code: "COMMAND_THROTTLED",
      retryAfterMs: 500,
    });
  });

  it("rejects enqueue with QUEUE_FULL beyond the outstanding limit", async () => {
    const queue = makeQueue({ maxOutstanding: 2 });
    await markBridgeConnected(queue);

    const first = queue.enqueueAndAwait(enqueueRequest());
    const second = queue.enqueueAndAwait(enqueueRequest());
    ignoreRejection(first);
    ignoreRejection(second);

    await expect(queue.enqueueAndAwait(enqueueRequest())).rejects.toMatchObject({
      code: "QUEUE_FULL",
    });
  });

  it("honors the max batch size across successive polls", async () => {
    const queue = makeQueue();
    await markBridgeConnected(queue);

    for (let i = 0; i < 3; i += 1) {
      ignoreRejection(queue.enqueueAndAwait(enqueueRequest()));
    }

    const first = await queue.dequeue({
      max: 2,
      timeoutMs: 1,
      signal: new AbortController().signal,
    });
    expect(first).toHaveLength(2);

    const second = await queue.dequeue({
      max: 2,
      timeoutMs: 1,
      signal: new AbortController().signal,
    });
    expect(second).toHaveLength(1);
  });

  it("reports queue statistics", async () => {
    const queue = makeQueue();
    expect(queue.stats()).toEqual({ depth: 0, inFlight: 0, bridgeConnected: false });

    await markBridgeConnected(queue);
    expect(queue.stats().bridgeConnected).toBe(true);

    ignoreRejection(queue.enqueueAndAwait(enqueueRequest()));
    ignoreRejection(queue.enqueueAndAwait(enqueueRequest()));
    expect(queue.stats()).toMatchObject({ depth: 2, inFlight: 0 });

    const batch = await queue.dequeue({
      max: 1,
      timeoutMs: 1,
      signal: new AbortController().signal,
    });
    expect(batch).toHaveLength(1);
    expect(queue.stats()).toMatchObject({ depth: 1, inFlight: 1 });
  });

  it("rejects pending commands and releases parked polls on close", async () => {
    const queue = makeQueue();
    await markBridgeConnected(queue);

    const resultPromise = queue.enqueueAndAwait(enqueueRequest());
    // Drain the command so the next poll genuinely parks on an empty queue.
    const drained = await queue.dequeue({
      max: 10,
      timeoutMs: 1,
      signal: new AbortController().signal,
    });
    expect(drained).toHaveLength(1);

    const parkedPoll = queue.dequeue({
      max: 10,
      timeoutMs: 60_000,
      signal: new AbortController().signal,
    });

    queue.close();

    await expect(resultPromise).rejects.toMatchObject({ code: "BRIDGE_DISCONNECTED" });
    await expect(parkedPoll).resolves.toEqual([]);
    await expect(queue.enqueueAndAwait(enqueueRequest())).rejects.toMatchObject({
      code: "BRIDGE_DISCONNECTED",
    });
  });
});
