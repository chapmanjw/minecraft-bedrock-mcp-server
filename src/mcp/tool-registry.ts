import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolContext, ToolDefinition } from "../tools/tool-definition.js";
import { toErrorResult } from "../tools/tool-result.js";

/** Builds a per-invocation {@link ToolContext} from MCP request metadata. */
export type ToolContextFactory = (extra: {
  readonly signal: AbortSignal;
  readonly requestId: string | number;
}) => ToolContext;

/**
 * Registers every tool definition on an MCP server.
 *
 * Each handler is wrapped so that a thrown error becomes a coded error
 * envelope rather than a transport-level failure.
 */
export function registerTools(
  server: McpServer,
  tools: readonly ToolDefinition[],
  contextFor: ToolContextFactory,
): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: tool.inputShape,
        annotations: tool.annotations,
      },
      async (input: unknown, extra) => {
        const context = contextFor({ signal: extra.signal, requestId: extra.requestId });
        try {
          return await tool.handler(input, context);
        } catch (error) {
          context.logger.error({ err: error, tool: tool.name }, "tool handler failed");
          return toErrorResult(error);
        }
      },
    );
  }
}
