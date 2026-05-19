import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { SubscriptionRegistry } from "../events/subscription-registry.js";
import type { Logger } from "../observability/logger.js";
import type { CommandQueue } from "../queue/command-queue.js";
import { SERVER_NAME, SERVER_VERSION } from "../server-info.js";
import type { StructureFileStore } from "../structures/structure-file-store.js";
import { allTools } from "../tools/index.js";
import { registerTools } from "./tool-registry.js";

/** Domain services shared by every per-session MCP server. */
export interface McpServerDependencies {
  readonly queue: CommandQueue;
  readonly subscriptions: SubscriptionRegistry;
  readonly structureFiles: StructureFileStore;
  /** The `mcp:` namespace store — `structures/mcp/` — used by `mc_structure_upload`. */
  readonly mcpStructures: StructureFileStore;
  readonly logger: Logger;
  readonly commandTimeoutMs: number;
}

/**
 * Creates an MCP server for a single client session, with the full tool
 * surface registered. Tool handlers close over the shared domain services; the
 * per-session `McpServer` instances are otherwise cheap and independent.
 */
export function createMcpServer(deps: McpServerDependencies): McpServer {
  const server = new McpServer({ name: SERVER_NAME, version: SERVER_VERSION });
  registerTools(server, allTools, (extra) => ({
    queue: deps.queue,
    subscriptions: deps.subscriptions,
    structureFiles: deps.structureFiles,
    mcpStructures: deps.mcpStructures,
    logger: deps.logger,
    commandTimeoutMs: deps.commandTimeoutMs,
    correlationId: String(extra.requestId),
    signal: extra.signal,
  }));
  return server;
}
