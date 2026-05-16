import type { FastifyInstance } from "fastify";
import { CommandResultSchema } from "../protocol/index.js";
import type { CommandQueue } from "../queue/command-queue.js";

/**
 * Registers `POST /result` (mounted at `/bridge/result`).
 *
 * Settles the command correlated by `id`. A result for an unknown or expired
 * command is acknowledged but logged — it is not an error for the pack.
 */
export function registerResultRoute(app: FastifyInstance, queue: CommandQueue): void {
  app.post("/result", (request, reply) => {
    const parsed = CommandResultSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "INVALID_INPUT", message: "malformed command result" } });
    }

    const matched = queue.settle(parsed.data);
    if (!matched) {
      request.log.warn(
        { commandId: parsed.data.id },
        "received result for an unknown or expired command",
      );
    }
    return reply.code(202).send({ accepted: matched });
  });
}
