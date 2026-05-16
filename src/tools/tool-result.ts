import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BridgeError } from "../errors/bridge-error.js";
import type { CommandResult } from "../protocol/index.js";

function describe(data: unknown): string {
  if (data === undefined) return "(no content)";
  return JSON.stringify(data, null, 2);
}

/**
 * Builds a successful tool result.
 *
 * The structured content is always `{ result: <data> }` so every tool's
 * machine-readable output has a consistent shape.
 */
export function toolSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: describe(data) }],
    structuredContent: { result: data },
    isError: false,
  };
}

/** Builds a failed tool result carrying a stable error code. */
export function toolError(code: string, message: string, details?: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: `${code}: ${message}` }],
    structuredContent: {
      error: { code, message, ...(details === undefined ? {} : { details }) },
    },
    isError: true,
  };
}

/** Maps a behavior-pack {@link CommandResult} to a tool envelope. */
export function toCallToolResult(result: CommandResult): CallToolResult {
  return result.status === "ok"
    ? toolSuccess(result.result)
    : toolError(result.error.code, result.error.message, result.error.details);
}

/** Maps an error thrown by a tool handler to a tool envelope. */
export function toErrorResult(error: unknown): CallToolResult {
  if (BridgeError.is(error)) {
    return toolError(error.code, error.message, error.details);
  }
  return toolError("INTERNAL", error instanceof Error ? error.message : "unexpected error");
}
