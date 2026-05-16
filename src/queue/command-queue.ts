import { BridgeError } from "../errors/bridge-error.js";
import type { Command } from "../protocol/command.js";
import type { CommandResult } from "../protocol/result.js";
import { newCommandId, type CommandId } from "./command-id.js";
import { createPendingCommands, type PendingCommands } from "./pending-commands.js";
import type { CommandThrottle } from "./command-throttle.js";

/** A request to enqueue a command and await its correlated result. */
export interface EnqueueRequest {
  /** Command kind — the MCP tool name, e.g. `mc_block_set`. */
  readonly kind: string;
  /** Command payload, validated against the tool's input schema by the caller. */
  readonly payload: unknown;
  /** Server-side correlation id linking the originating request to this command. */
  readonly correlationId: string;
  /** How long, in milliseconds, to await a result before failing. */
  readonly timeoutMs: number;
}

/** Options for a long-poll dequeue. */
export interface DequeueOptions {
  /** Maximum number of commands to return in one batch. */
  readonly max: number;
  /** How long, in milliseconds, to hold the poll open while the queue is empty. */
  readonly timeoutMs: number;
  /** Aborts the poll when the underlying HTTP connection closes. */
  readonly signal: AbortSignal;
}

/** A point-in-time snapshot of queue state, for health checks and metrics. */
export interface CommandQueueStats {
  /** Commands enqueued but not yet dequeued. */
  readonly depth: number;
  /** Commands dequeued but not yet settled. */
  readonly inFlight: number;
  /** Whether a behavior pack is currently considered connected. */
  readonly bridgeConnected: boolean;
}

/**
 * In-memory command queue bridging MCP tool calls to the behavior pack.
 *
 * Tool calls enqueue commands and await their correlated results; the behavior
 * pack drains commands via a long poll and reports results back. The queue is
 * not persisted across restarts.
 */
export interface CommandQueue {
  /**
   * Enqueues a command and resolves with the behavior pack's result.
   *
   * Resolves with a {@link CommandResult} (`ok` or `error`) once the pack
   * reports one. Rejects with a `BridgeError` when the bridge itself cannot
   * complete the command: `COMMAND_THROTTLED`, `QUEUE_FULL`,
   * `BRIDGE_DISCONNECTED`, or `COMMAND_TIMEOUT`.
   */
  enqueueAndAwait(request: EnqueueRequest): Promise<CommandResult>;

  /**
   * Long-poll dequeue for the behavior pack.
   *
   * Resolves immediately with up to `max` commands when work is available,
   * otherwise holds the poll open until a command arrives, `timeoutMs`
   * elapses, or the request is aborted — resolving with `[]` in the latter
   * two cases.
   */
  dequeue(options: DequeueOptions): Promise<Command[]>;

  /**
   * Delivers a result reported by the behavior pack.
   *
   * @returns `false` if no pending command matches `result.id` — typically a
   *   result that arrived after the command's deadline.
   */
  settle(result: CommandResult): boolean;

  /** Returns a snapshot of queue state. */
  stats(): CommandQueueStats;

  /**
   * Rejects all pending commands and releases parked polls. Used during
   * graceful shutdown; the queue must not be used afterwards.
   */
  close(): void;
}

/** Configuration for {@link createCommandQueue}. */
export interface CommandQueueOptions {
  /** Per-kind throttle protecting the behavior pack's script watchdog. */
  readonly throttle: CommandThrottle;
  /** Maximum outstanding commands before enqueue fails with `QUEUE_FULL`. */
  readonly maxOutstanding: number;
  /**
   * Milliseconds after the last poll during which the behavior pack is still
   * considered connected. Should exceed the poll timeout.
   */
  readonly livenessWindowMs: number;
  /** Clock source, injectable for tests. Defaults to `Date.now`. */
  readonly now?: () => number;
}

/** A command held in the queue, in server-internal form. */
interface QueuedCommand {
  readonly id: CommandId;
  readonly kind: string;
  readonly payload: unknown;
  readonly issuedAt: number;
  readonly deadlineAt: number;
  readonly correlationId: string;
}

/** A poll parked waiting for the next command to be enqueued. */
interface PollWaiter {
  readonly wake: () => void;
}

/** Creates an in-memory {@link CommandQueue}. */
export function createCommandQueue(options: CommandQueueOptions): CommandQueue {
  const now = options.now ?? Date.now;
  const pending: PendingCommands = createPendingCommands();
  const ready: QueuedCommand[] = [];
  const waiters: PollWaiter[] = [];

  let lastPollAt = 0;
  let activePolls = 0;
  let closed = false;

  function bridgeConnected(): boolean {
    return activePolls > 0 || now() - lastPollAt < options.livenessWindowMs;
  }

  function wakeNextWaiter(): void {
    waiters.shift()?.wake();
  }

  function dropFromReady(id: CommandId): void {
    const index = ready.findIndex((command) => command.id === id);
    if (index >= 0) ready.splice(index, 1);
  }

  function takeReady(max: number, at: number): Command[] {
    const batch: Command[] = [];
    while (batch.length < max) {
      const command = ready.shift();
      if (!command) break;
      // A command past its deadline has already been (or will be) rejected by
      // the pending registry; never deliver it.
      if (command.deadlineAt <= at) continue;
      batch.push({
        id: command.id,
        kind: command.kind,
        payload: command.payload,
        issued_at: new Date(command.issuedAt).toISOString(),
        deadline_ms: command.deadlineAt - at,
      });
    }
    return batch;
  }

  /** Resolves when a command is enqueued, the timeout elapses, or `signal` aborts. */
  function awaitCommand(timeoutMs: number, signal: AbortSignal): Promise<void> {
    return new Promise<void>((resolve) => {
      let settled = false;
      const waiter: PollWaiter = { wake: finish };
      const timer = setTimeout(finish, timeoutMs);
      timer.unref();
      signal.addEventListener("abort", finish, { once: true });
      waiters.push(waiter);

      function finish(): void {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        signal.removeEventListener("abort", finish);
        const index = waiters.indexOf(waiter);
        if (index >= 0) waiters.splice(index, 1);
        resolve();
      }
    });
  }

  return {
    async enqueueAndAwait(request) {
      if (closed) {
        throw new BridgeError({
          code: "BRIDGE_DISCONNECTED",
          message: "the command queue is closed",
        });
      }
      if (!bridgeConnected()) {
        throw new BridgeError({
          code: "BRIDGE_DISCONNECTED",
          message: "no behavior pack is connected to the bridge",
        });
      }
      if (pending.size() >= options.maxOutstanding) {
        throw new BridgeError({
          code: "QUEUE_FULL",
          message: `the command queue is at capacity (${options.maxOutstanding} outstanding)`,
        });
      }

      const throttled = options.throttle.tryAdmit(request.kind);
      if (throttled) {
        throw new BridgeError({
          code: "COMMAND_THROTTLED",
          message: `command kind '${request.kind}' is being throttled`,
          retryAfterMs: throttled.retryAfterMs,
          details: { kind: request.kind },
        });
      }

      const id = newCommandId();
      const issuedAt = now();
      const deadlineAt = issuedAt + request.timeoutMs;

      const result = pending.register(id, deadlineAt);
      ready.push({
        id,
        kind: request.kind,
        payload: request.payload,
        issuedAt,
        deadlineAt,
        correlationId: request.correlationId,
      });
      // Once the command settles or times out, make sure it is not left
      // lingering in the ready buffer awaiting delivery.
      void result.then(
        () => {
          dropFromReady(id);
        },
        () => {
          dropFromReady(id);
        },
      );
      wakeNextWaiter();

      return await result;
    },

    async dequeue({ max, timeoutMs, signal }) {
      lastPollAt = now();
      activePolls += 1;
      try {
        if (ready.length === 0 && !signal.aborted && !closed) {
          await awaitCommand(timeoutMs, signal);
        }
        return takeReady(max, now());
      } finally {
        activePolls -= 1;
      }
    },

    settle(result) {
      return pending.settle(result.id, result);
    },

    stats() {
      return {
        depth: ready.length,
        inFlight: Math.max(0, pending.size() - ready.length),
        bridgeConnected: bridgeConnected(),
      };
    },

    close() {
      if (closed) return;
      closed = true;
      ready.length = 0;
      pending.rejectAll(
        new BridgeError({ code: "BRIDGE_DISCONNECTED", message: "the bridge is shutting down" }),
      );
      while (waiters.length > 0) wakeNextWaiter();
    },
  };
}
