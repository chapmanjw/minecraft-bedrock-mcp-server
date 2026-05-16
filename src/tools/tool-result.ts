import { encode } from "@toon-format/toon";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { BridgeError } from "../errors/bridge-error.js";
import type { CommandResult } from "../protocol/index.js";

/**
 * Serializes a tool payload as TOON (Token-Oriented Object Notation).
 *
 * TOON is a compact, LLM-oriented encoding of the JSON data model: it drops
 * JSON's braces, quotes, and repeated keys, and renders uniform object arrays
 * as a single header plus CSV-style rows. For the tabular results this server
 * produces — block volumes, entity component dumps, player and event lists —
 * that is materially fewer tokens than JSON, and never more than the
 * pretty-printed JSON this previously emitted.
 */
function serialize(data: unknown): string {
  if (data === undefined) return "(no content)";
  return encode(data);
}

/**
 * Builds a successful tool result.
 *
 * The payload is carried once, as a TOON text block. Tools declare no
 * `outputSchema`, so no redundant `structuredContent` copy is emitted — the
 * text block is the single machine- and human-readable representation.
 */
export function toolSuccess(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: serialize(data) }],
    isError: false,
  };
}

/** Builds a failed tool result carrying a stable error code. */
export function toolError(code: string, message: string, details?: unknown): CallToolResult {
  const error = { code, message, ...(details === undefined ? {} : { details }) };
  return {
    content: [{ type: "text", text: encode({ error }) }],
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
