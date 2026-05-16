import { randomUUID } from "node:crypto";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Logger } from "../observability/logger.js";

interface McpSession {
  readonly server: McpServer;
  readonly transport: StreamableHTTPServerTransport;
}

/**
 * Tracks live MCP client sessions, each pairing a `StreamableHTTPServerTransport`
 * with its own `McpServer`.
 */
export interface SessionManager {
  /** Returns the transport for an established session, if one exists. */
  get(sessionId: string): StreamableHTTPServerTransport | undefined;
  /**
   * Creates a transport for a new session and connects a fresh `McpServer` to
   * it. The caller drives the `initialize` request through the returned
   * transport; the session registers itself once the transport assigns an id.
   */
  create(): Promise<StreamableHTTPServerTransport>;
  /** Number of established sessions. */
  count(): number;
  /** Closes every session — used during graceful shutdown. */
  closeAll(): Promise<void>;
}

/** Configuration for {@link createSessionManager}. */
export interface SessionManagerOptions {
  readonly logger: Logger;
  /** Factory for the per-session `McpServer` (with its tools registered). */
  readonly createServer: () => McpServer;
}

/** Creates an empty {@link SessionManager}. */
export function createSessionManager(options: SessionManagerOptions): SessionManager {
  const sessions = new Map<string, McpSession>();

  return {
    get(sessionId) {
      return sessions.get(sessionId)?.transport;
    },

    async create() {
      const server = options.createServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (sessionId) => {
          sessions.set(sessionId, { server, transport });
          options.logger.info({ sessionId, sessionCount: sessions.size }, "mcp session opened");
        },
      });
      transport.onclose = () => {
        const sessionId = transport.sessionId;
        if (sessionId !== undefined && sessions.delete(sessionId)) {
          options.logger.info({ sessionId, sessionCount: sessions.size }, "mcp session closed");
        }
      };
      await server.connect(transport);
      return transport;
    },

    count() {
      return sessions.size;
    },

    async closeAll() {
      const open = [...sessions.values()];
      sessions.clear();
      await Promise.allSettled(
        open.flatMap((session) => [session.transport.close(), session.server.close()]),
      );
    },
  };
}
