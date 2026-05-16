import { describe, expect, it } from "vitest";
import { BridgeError } from "../../src/errors/bridge-error.js";
import { createMetrics, type MetricsCollectors } from "../../src/observability/metrics.js";
import type { CommandResult } from "../../src/protocol/index.js";
import type { CommandQueue, EnqueueRequest } from "../../src/queue/command-queue.js";
import { createInstrumentedCommandQueue } from "../../src/queue/instrumented-command-queue.js";

const ZERO: MetricsCollectors = {
  queueDepth: () => 0,
  commandsInFlight: () => 0,
  bridgeConnected: () => false,
  mcpSessions: () => 0,
};

const REQUEST: EnqueueRequest = {
  kind: "mc_block_set",
  payload: {},
  correlationId: "c1",
  timeoutMs: 1_000,
};

function fakeQueue(enqueueAndAwait: CommandQueue["enqueueAndAwait"]): CommandQueue {
  return {
    enqueueAndAwait,
    dequeue: () => Promise.resolve([]),
    settle: () => true,
    stats: () => ({ depth: 0, inFlight: 0, bridgeConnected: false }),
    close: () => undefined,
  };
}

describe("instrumented command queue", () => {
  it("records a successful command", async () => {
    const okResult: CommandResult = { id: "cmd_x", status: "ok", result: { ok: true } };
    const metrics = createMetrics(ZERO);
    const queue = createInstrumentedCommandQueue(
      fakeQueue(() => Promise.resolve(okResult)),
      metrics,
    );

    await queue.enqueueAndAwait(REQUEST);

    const text = await metrics.registry.metrics();
    expect(text).toContain(
      'bridge_command_results_total{kind="mc_block_set",status="ok",code=""} 1',
    );
  });

  it("records a rejected command with its error code", async () => {
    const metrics = createMetrics(ZERO);
    const queue = createInstrumentedCommandQueue(
      fakeQueue(() =>
        Promise.reject(new BridgeError({ code: "COMMAND_TIMEOUT", message: "timed out" })),
      ),
      metrics,
    );

    await expect(queue.enqueueAndAwait(REQUEST)).rejects.toBeInstanceOf(BridgeError);

    const text = await metrics.registry.metrics();
    expect(text).toContain('status="error",code="COMMAND_TIMEOUT"');
  });

  it("delegates non-instrumented operations to the inner queue", () => {
    const metrics = createMetrics(ZERO);
    const queue = createInstrumentedCommandQueue(
      fakeQueue(() => Promise.resolve({ id: "cmd_x", status: "ok", result: {} })),
      metrics,
    );

    expect(queue.settle({ id: "cmd_x", status: "ok", result: {} })).toBe(true);
    expect(queue.stats()).toEqual({ depth: 0, inFlight: 0, bridgeConnected: false });
  });
});
