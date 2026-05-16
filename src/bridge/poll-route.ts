import type { FastifyInstance } from "fastify";
import type { PollResponse } from "../protocol/index.js";
import type { CommandQueue } from "../queue/command-queue.js";

/** Maximum number of commands handed to the behavior pack in one poll. */
const POLL_BATCH_SIZE = 32;

/**
 * Registers `GET /poll` (mounted at `/bridge/poll`).
 *
 * Long-polls the command queue: the request is held open until commands are
 * available or the poll timeout elapses. Closing the connection aborts the
 * wait so commands are never handed to a dead socket.
 */
export function registerPollRoute(
  app: FastifyInstance,
  queue: CommandQueue,
  pollTimeoutMs: number,
): void {
  app.get("/poll", async (request) => {
    const controller = new AbortController();
    request.raw.on("close", () => {
      controller.abort();
    });

    const commands = await queue.dequeue({
      max: POLL_BATCH_SIZE,
      timeoutMs: pollTimeoutMs,
      signal: controller.signal,
    });

    const response: PollResponse = {
      commands,
      server_time: new Date().toISOString(),
    };
    return response;
  });
}
