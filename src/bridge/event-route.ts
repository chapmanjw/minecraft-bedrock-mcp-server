import type { FastifyInstance } from "fastify";
import type { SubscriptionRegistry } from "../events/subscription-registry.js";
import { EventReportSchema } from "../protocol/index.js";

/**
 * Registers `POST /event` (mounted at `/bridge/event`).
 *
 * Validates an event report and buffers each event under its subscription.
 * Events for unknown subscriptions are dropped and logged — not an error for
 * the behavior pack, which may report an event mid-unsubscribe.
 */
export function registerEventRoute(
  app: FastifyInstance,
  subscriptions: SubscriptionRegistry,
): void {
  app.post("/event", (request, reply) => {
    const parsed = EventReportSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply
        .code(400)
        .send({ error: { code: "INVALID_INPUT", message: "malformed event report" } });
    }

    let ingested = 0;
    for (const event of parsed.data.events) {
      if (subscriptions.ingest(event)) ingested += 1;
    }
    if (ingested < parsed.data.events.length) {
      request.log.warn(
        { received: parsed.data.events.length, ingested },
        "some reported events referenced unknown subscriptions",
      );
    }
    return reply.code(202).send({ accepted: ingested });
  });
}
