import { BridgeError } from "../errors/bridge-error.js";
import type { Metrics } from "../observability/metrics.js";
import type { CommandResult } from "../protocol/index.js";
import type { CommandQueue, EnqueueRequest } from "./command-queue.js";

/**
 * Wraps a {@link CommandQueue}, recording each command's duration and outcome
 * to {@link Metrics}. Composition keeps the base queue free of metrics
 * concerns; the wrapper is applied only when metrics are enabled.
 */
export function createInstrumentedCommandQueue(
  inner: CommandQueue,
  metrics: Metrics,
  now: () => number = Date.now,
): CommandQueue {
  return {
    async enqueueAndAwait(request: EnqueueRequest): Promise<CommandResult> {
      const startedAt = now();
      try {
        const result = await inner.enqueueAndAwait(request);
        metrics.recordCommand({
          kind: request.kind,
          status: result.status,
          code: result.status === "error" ? result.error.code : undefined,
          durationMs: now() - startedAt,
        });
        return result;
      } catch (error) {
        metrics.recordCommand({
          kind: request.kind,
          status: "error",
          code: BridgeError.is(error) ? error.code : "INTERNAL",
          durationMs: now() - startedAt,
        });
        throw error;
      }
    },
    dequeue: (options) => inner.dequeue(options),
    settle: (result) => inner.settle(result),
    stats: () => inner.stats(),
    close: () => {
      inner.close();
    },
  };
}
