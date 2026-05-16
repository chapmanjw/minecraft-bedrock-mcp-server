import type { FastifyInstance } from "fastify";
import type { CommandQueue } from "../queue/command-queue.js";

/**
 * Registers `GET /healthz` — an unauthenticated liveness probe.
 *
 * Always returns `200` while the process is responsive; behavior-pack
 * connectivity is reported in the body as readiness information.
 */
export function registerHealthRoute(app: FastifyInstance, queue: CommandQueue): void {
  app.get("/healthz", () => {
    const stats = queue.stats();
    return {
      status: "ok",
      bridge_connected: stats.bridgeConnected,
      queue_depth: stats.depth,
      commands_in_flight: stats.inFlight,
    };
  });
}
