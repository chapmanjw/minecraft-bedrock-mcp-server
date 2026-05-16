import type { FastifyInstance } from "fastify";
import type { Metrics } from "../observability/metrics.js";

/**
 * Registers `GET /metrics` — the Prometheus scrape endpoint. Mounted only when
 * `BRIDGE_METRICS_ENABLED` is set.
 */
export function registerMetricsRoute(app: FastifyInstance, metrics: Metrics): void {
  app.get("/", async (_request, reply) => {
    const body = await metrics.registry.metrics();
    return reply.header("content-type", metrics.registry.contentType).send(body);
  });
}
