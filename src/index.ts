#!/usr/bin/env node
import { join } from "node:path";
import { ConfigError } from "./config/config-error.js";
import { loadEnvironment, type Environment } from "./config/environment.js";
import { loadTlsMaterial, type TlsMaterial } from "./config/tls.js";
import { createSubscriptionRegistry } from "./events/subscription-registry.js";
import { createApp } from "./http/app.js";
import { createMcpServer } from "./mcp/mcp-server-factory.js";
import { createSessionManager } from "./mcp/session-manager.js";
import { createLogger } from "./observability/logger.js";
import { createMetrics, type Metrics } from "./observability/metrics.js";
import { createCommandQueue, type CommandQueue } from "./queue/command-queue.js";
import { createCommandThrottle } from "./queue/command-throttle.js";
import { createInstrumentedCommandQueue } from "./queue/instrumented-command-queue.js";
import { SERVER_NAME, SERVER_VERSION } from "./server-info.js";
import { createStructureFileStore } from "./structures/structure-file-store.js";

/** Default per-kind command admission rate, protecting the script watchdog. */
const DEFAULT_THROTTLE = { ratePerSecond: 20, burst: 40 } as const;

/** Events retained per subscription before the oldest are dropped. */
const EVENT_BUFFER_SIZE = 512;

/** Writes a message to stderr and exits non-zero. */
function fail(message: string): never {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function describeError(error: unknown): string {
  if (error instanceof ConfigError) return error.message;
  return error instanceof Error ? error.message : String(error);
}

function loadConfig(): Environment {
  try {
    return loadEnvironment();
  } catch (error) {
    return fail(describeError(error));
  }
}

function loadTls(environment: Environment): TlsMaterial | null {
  try {
    return loadTlsMaterial(environment);
  } catch (error) {
    return fail(describeError(error));
  }
}

async function main(): Promise<void> {
  const environment = loadConfig();
  const logger = createLogger({
    level: environment.BRIDGE_LOG_LEVEL,
    pretty: process.stdout.isTTY === true,
  });

  const tls = loadTls(environment);
  if (tls === null) {
    logger.warn(
      "TLS is not configured — the bridge is serving plain HTTP. Bearer tokens and " +
        "world data will cross the network unencrypted. Set BRIDGE_TLS_CERT and " +
        "BRIDGE_TLS_KEY (see the README for the mkcert workflow), or terminate TLS at a " +
        "reverse proxy and bind the server to localhost.",
    );
  }

  const baseQueue = createCommandQueue({
    throttle: createCommandThrottle({ defaultPolicy: DEFAULT_THROTTLE }),
    maxOutstanding: environment.BRIDGE_QUEUE_MAX,
    livenessWindowMs: environment.BRIDGE_POLL_TIMEOUT_MS * 2,
  });
  const subscriptions = createSubscriptionRegistry({ bufferSize: EVENT_BUFFER_SIZE });
  const structuresDir = join(environment.BRIDGE_BEHAVIOR_PACK_PATH, "structures");
  const structureFiles = createStructureFileStore(structuresDir);
  // `mc_structure_upload` writes into the reserved `mcp/` namespace folder, so
  // an uploaded structure is always placed as `mcp:<name>`.
  const mcpStructures = createStructureFileStore(join(structuresDir, "mcp"));

  // When metrics are enabled, the queue is wrapped to record command metrics
  // and the gauges sample the base queue and session manager at scrape time.
  let metrics: Metrics | undefined;
  let queue: CommandQueue = baseQueue;
  if (environment.BRIDGE_METRICS_ENABLED) {
    metrics = createMetrics({
      queueDepth: () => baseQueue.stats().depth,
      commandsInFlight: () => baseQueue.stats().inFlight,
      bridgeConnected: () => baseQueue.stats().bridgeConnected,
      mcpSessions: () => sessionManager.count(),
    });
    queue = createInstrumentedCommandQueue(baseQueue, metrics);
  }

  const sessionManager = createSessionManager({
    logger,
    createServer: () =>
      createMcpServer({
        queue,
        subscriptions,
        structureFiles,
        mcpStructures,
        logger,
        commandTimeoutMs: environment.BRIDGE_COMMAND_TIMEOUT_MS,
      }),
  });
  const app = createApp({
    environment,
    logger,
    queue,
    subscriptions,
    sessionManager,
    metrics,
    tls,
  });

  let shuttingDown = false;
  async function shutdown(signal: NodeJS.Signals): Promise<void> {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, "shutting down");
    queue.close();
    await sessionManager.closeAll();
    await app.close();
    process.exit(0);
  }
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, (received) => {
      void shutdown(received);
    });
  }

  try {
    await app.listen({ host: environment.BRIDGE_HOST, port: environment.BRIDGE_PORT });
  } catch (error) {
    logger.error({ err: error }, "failed to start the bridge server");
    process.exit(1);
  }

  const scheme = tls === null ? "http" : "https";
  logger.info(
    {
      name: SERVER_NAME,
      version: SERVER_VERSION,
      address: `${scheme}://${environment.BRIDGE_HOST}:${environment.BRIDGE_PORT}`,
      metrics: environment.BRIDGE_METRICS_ENABLED,
    },
    "bridge server listening",
  );
}

void main().catch((error: unknown) => {
  process.stderr.write(`fatal: ${describeError(error)}\n`);
  process.exit(1);
});
