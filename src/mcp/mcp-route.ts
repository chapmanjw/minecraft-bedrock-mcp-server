import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { SessionManager } from "./session-manager.js";

function headerValue(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function sendMissingSession(reply: FastifyReply): FastifyReply {
  return reply
    .code(400)
    .send({ error: { code: "INVALID_INPUT", message: "missing or unknown MCP session" } });
}

/**
 * Registers the MCP Streamable HTTP endpoint (mounted at `/mcp`).
 *
 * `POST` carries JSON-RPC messages and opens a session on `initialize`; `GET`
 * opens the server-to-client SSE stream; `DELETE` terminates a session. The
 * transport writes responses directly to the raw socket, so each handler
 * hijacks the Fastify reply.
 */
export function registerMcpRoute(app: FastifyInstance, sessions: SessionManager): void {
  app.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const sessionId = headerValue(request.headers["mcp-session-id"]);
    const existing = sessionId === undefined ? undefined : sessions.get(sessionId);

    let transport: StreamableHTTPServerTransport;
    if (existing !== undefined) {
      transport = existing;
    } else if (sessionId === undefined && isInitializeRequest(request.body)) {
      transport = await sessions.create();
    } else {
      return sendMissingSession(reply);
    }

    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw, request.body);
    return reply;
  });

  const streamHandler = async (
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<FastifyReply> => {
    const sessionId = headerValue(request.headers["mcp-session-id"]);
    const transport = sessionId === undefined ? undefined : sessions.get(sessionId);
    if (transport === undefined) {
      return sendMissingSession(reply);
    }
    reply.hijack();
    await transport.handleRequest(request.raw, reply.raw);
    return reply;
  };

  app.get("/", streamHandler);
  app.delete("/", streamHandler);
}
