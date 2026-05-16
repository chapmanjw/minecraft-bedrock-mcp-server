import { BridgeError } from "../errors/bridge-error.js";
import type { CommandResult } from "../protocol/result.js";
import type { CommandId } from "./command-id.js";

interface PendingEntry {
  readonly resolve: (result: CommandResult) => void;
  readonly reject: (error: BridgeError) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/**
 * Registry of in-flight commands awaiting a correlated result.
 *
 * A command is registered when it is enqueued and removed when the behavior
 * pack settles it or when its deadline elapses.
 */
export interface PendingCommands {
  /**
   * Registers a command and returns a promise for its result.
   *
   * Resolves with the {@link CommandResult} reported by the behavior pack
   * (whether `ok` or `error`). Rejects with a `COMMAND_TIMEOUT` `BridgeError`
   * if `deadlineAt` is reached first.
   *
   * @param deadlineAt - Absolute epoch-millisecond deadline.
   */
  register(id: CommandId, deadlineAt: number): Promise<CommandResult>;

  /**
   * Delivers a result to a registered command.
   *
   * @returns `true` if a pending command matched; `false` if the id is
   *   unknown or already settled (e.g. a result that arrived after timeout).
   */
  settle(id: CommandId, result: CommandResult): boolean;

  /** Rejects every pending command — used during graceful shutdown. */
  rejectAll(error: BridgeError): void;

  /** Number of commands currently awaiting a result. */
  size(): number;
}

/** Creates an empty {@link PendingCommands} registry. */
export function createPendingCommands(): PendingCommands {
  const entries = new Map<CommandId, PendingEntry>();

  return {
    register(id, deadlineAt) {
      return new Promise<CommandResult>((resolve, reject) => {
        const delayMs = Math.max(0, deadlineAt - Date.now());
        const timer = setTimeout(() => {
          entries.delete(id);
          reject(
            new BridgeError({
              code: "COMMAND_TIMEOUT",
              message: `command ${id} did not complete within ${delayMs} ms`,
            }),
          );
        }, delayMs);
        timer.unref();
        entries.set(id, { resolve, reject, timer });
      });
    },

    settle(id, result) {
      const entry = entries.get(id);
      if (!entry) return false;
      clearTimeout(entry.timer);
      entries.delete(id);
      entry.resolve(result);
      return true;
    },

    rejectAll(error) {
      for (const entry of entries.values()) {
        clearTimeout(entry.timer);
        entry.reject(error);
      }
      entries.clear();
    },

    size() {
      return entries.size;
    },
  };
}
