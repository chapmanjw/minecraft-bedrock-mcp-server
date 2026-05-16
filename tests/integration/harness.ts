import type { FastifyInstance } from "fastify";
import { loadEnvironment, type Environment } from "../../src/config/environment.js";
import { createApp } from "../../src/http/app.js";
import { createMcpServer } from "../../src/mcp/mcp-server-factory.js";
import { createSessionManager } from "../../src/mcp/session-manager.js";
import { createLogger } from "../../src/observability/logger.js";
import { createCommandQueue, type CommandQueue } from "../../src/queue/command-queue.js";
import { createCommandThrottle } from "../../src/queue/command-throttle.js";

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
  const sessionManager = createSessionManager({ logger, createServer: createMcpServer });
  const app = createApp({ environment, logger, queue, sessionManager, tls: null });

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
