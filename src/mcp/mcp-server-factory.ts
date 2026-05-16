import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SERVER_NAME, SERVER_VERSION } from "../server-info.js";

/**
 * Creates an MCP server instance for a single client session.
 *
 * Each session gets its own `McpServer`; the instances are cheap and share the
 * process-wide domain services (the command queue and registries) through the
 * tools registered on them. Tool registration is wired in a later phase — for
 * now the server exposes the MCP protocol surface with no tools.
 */
export function createMcpServer(): McpServer {
  return new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });
}
