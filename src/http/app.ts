import { createHash, randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import Fastify, { type FastifyBaseLogger, type FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { registerEventRoute } from "../bridge/event-route.js";
import { registerHandshakeRoute } from "../bridge/handshake-route.js";
import { registerPollRoute } from "../bridge/poll-route.js";
import { registerResultRoute } from "../bridge/result-route.js";
import { corsOrigins, type Environment } from "../config/environment.js";
import type { TlsMaterial } from "../config/tls.js";
import type { SubscriptionRegistry } from "../events/subscription-registry.js";
import { registerMcpRoute } from "../mcp/mcp-route.js";
import type { SessionManager } from "../mcp/session-manager.js";
import type { Logger } from "../observability/logger.js";
import type { CommandQueue } from "../queue/command-queue.js";
import { SERVER_VERSION } from "../server-info.js";
import { bearerAuth } from "./authentication.js";
import { registerHealthRoute } from "./health-route.js";

const CORRELATION_ID_HEADER = "x-correlation-id";

/** Dependencies required to assemble the HTTP application. */
export interface AppDependencies {
  readonly environment: Environment;
  readonly logger: Logger;
  readonly queue: CommandQueue;
  readonly subscriptions: SubscriptionRegistry;
  readonly sessionManager: SessionManager;
  readonly tls: TlsMaterial | null;
}

/** Derives a request correlation id from an inbound header, or mints one. */
function correlationIdFor(req: IncomingMessage): string {
  const header = req.headers[CORRELATION_ID_HEADER];
  if (typeof header === "string" && header.length > 0) return header;
  return randomUUID();
}

/** Per-token rate-limit key: a hash of the bearer header, never the raw token. */
function rateLimitKey(authorization: string | undefined): string {
  return createHash("sha256")
    .update(authorization ?? "anonymous")
    .digest("hex");
}

/**
 * Assembles the Fastify application: an unauthenticated health probe, the
 * agent-token `/bridge` surface, and the client-token, rate-limited `/mcp`
 * surface. The caller is responsible for calling `listen`.
 */
export function createApp(deps: AppDependencies): FastifyInstance {
  const { environment, logger, queue, subscriptions, sessionManager, tls } = deps;

  // Pin Fastify's logger generic to FastifyBaseLogger so the assembled
  // instance is the plain FastifyInstance the route helpers accept.
  const fastifyLogger: FastifyBaseLogger = logger;

  const app = Fastify({
    loggerInstance: fastifyLogger,
    genReqId: correlationIdFor,
    bodyLimit: environment.BRIDGE_MAX_BODY_BYTES,
    trustProxy: environment.BRIDGE_TRUST_PROXY,
    ...(tls === null ? {} : { https: { cert: tls.cert, key: tls.key } }),
  });

  const origins = corsOrigins(environment);
  if (origins !== null) {
    void app.register(cors, { origin: origins });
  }

  // Unauthenticated liveness probe.
  registerHealthRoute(app, queue);

  // Bridge surface — the behavior pack, authenticated with the agent token.
  void app.register(
    (bridge, _opts, done) => {
      bridge.addHook("onRequest", bearerAuth("agent", environment.BRIDGE_AGENT_TOKEN));
      registerPollRoute(bridge, queue, environment.BRIDGE_POLL_TIMEOUT_MS);
      registerResultRoute(bridge, queue);
      registerEventRoute(bridge, subscriptions);
      registerHandshakeRoute(
        bridge,
        SERVER_VERSION,
        environment.BRIDGE_POLL_TIMEOUT_MS,
        subscriptions,
      );
      done();
    },
    { prefix: "/bridge" },
  );

  // MCP surface — clients, authenticated with the client token, rate limited.
  void app.register(
    (mcp, _opts, done) => {
      mcp.addHook("onRequest", bearerAuth("client", environment.BRIDGE_CLIENT_TOKEN));
      void mcp.register(rateLimit, {
        max: environment.BRIDGE_RATE_LIMIT_RPM,
        timeWindow: "1 minute",
        keyGenerator: (request) => rateLimitKey(request.headers.authorization),
      });
      registerMcpRoute(mcp, sessionManager);
      done();
    },
    { prefix: "/mcp" },
  );

  return app;
}
