import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { loadEnvironment, type Environment } from "../../src/config/environment.js";
import { createSubscriptionRegistry } from "../../src/events/subscription-registry.js";
import { createApp } from "../../src/http/app.js";
import { createMcpServer } from "../../src/mcp/mcp-server-factory.js";
import { createSessionManager } from "../../src/mcp/session-manager.js";
import { createLogger } from "../../src/observability/logger.js";
import { createCommandQueue, type CommandQueue } from "../../src/queue/command-queue.js";
import { createCommandThrottle } from "../../src/queue/command-throttle.js";
import { createStructureFileStore } from "../../src/structures/structure-file-store.js";

/** Bearer token the harness configures for the MCP client surface. */
export const CLIENT_TOKEN = "test-client-token";
/** Bearer token the harness configures for the bridge surface. */
export const AGENT_TOKEN = "test-agent-token";

/** A built application plus the dependencies a test needs to drive it. */
export interface TestHarness {
  readonly app: FastifyInstance;
  readonly queue: CommandQueue;
  readonly close: () => Promise<void>;
}

function buildEnvironment(overrides: Record<string, string>): Environment {
  return loadEnvironment({
    BRIDGE_CLIENT_TOKEN: CLIENT_TOKEN,
    BRIDGE_AGENT_TOKEN: AGENT_TOKEN,
    BRIDGE_WORLD_PATH: "/tmp/bedrock-world",
    BRIDGE_BEHAVIOR_PACK_PATH: "/tmp/bedrock-world/behavior_packs/bridge",
    BRIDGE_POLL_TIMEOUT_MS: "200",
    ...overrides,
  });
}

/** Assembles an HTTP application wired to fresh, test-scoped dependencies. */
export function createTestHarness(overrides: Record<string, string> = {}): TestHarness {
  const environment = buildEnvironment(overrides);
  const logger = createLogger({ level: "silent", pretty: false });
  const queue = createCommandQueue({
    throttle: createCommandThrottle({ defaultPolicy: { ratePerSecond: 1000, burst: 1000 } }),
    maxOutstanding: environment.BRIDGE_QUEUE_MAX,
    livenessWindowMs: 60_000,
  });
  const subscriptions = createSubscriptionRegistry({ bufferSize: 128 });
  const structureFiles = createStructureFileStore(
    join(environment.BRIDGE_BEHAVIOR_PACK_PATH, "structures"),
  );
  const sessionManager = createSessionManager({
    logger,
    createServer: () =>
      createMcpServer({
        queue,
        subscriptions,
        structureFiles,
        logger,
        commandTimeoutMs: environment.BRIDGE_COMMAND_TIMEOUT_MS,
      }),
  });
  const app = createApp({ environment, logger, queue, subscriptions, sessionManager, tls: null });

  return {
    app,
    queue,
    close: async () => {
      queue.close();
      await sessionManager.closeAll();
      await app.close();
    },
  };
}
