import type { FastifyInstance } from "fastify";
import { EventReportSchema } from "../protocol/index.js";

/**
 * Registers `POST /event` (mounted at `/bridge/event`).
 *
 * Validates and acknowledges event reports from the behavior pack. Buffering
 * events against active subscriptions arrives with the subscription registry
 * in a later phase.
 */
export function registerEventRoute(app: FastifyInstance): void {
  app.post("/event", (request, reply) => {
    const parsed = EventReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "INVALID_INPUT", message: "malformed event report" } });
    }

    request.log.debug({ count: parsed.data.events.length }, "received event report");
    return reply.code(202).send({ accepted: parsed.data.events.length });
  });
}
