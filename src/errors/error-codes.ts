/**
 * Stable, machine-readable error codes used across the bridge.
 *
 * These codes are part of the server's public contract: a code is never
 * renamed or repurposed, only added. MCP clients and skills may switch on
 * them, so they must remain stable across minor versions.
 */
export const ERROR_CODES = [
  /** Missing or invalid bearer token. */
  "AUTH_INVALID",
  /** Per-token request rate limit exceeded on the MCP surface. */
  "RATE_LIMITED",
  /** Per-kind command throttle rejected the command to protect the script watchdog. */
  "COMMAND_THROTTLED",
  /** A command was not completed by the behavior pack within its deadline. */
  "COMMAND_TIMEOUT",
  /** Too many commands are outstanding; the queue is at capacity. */
  "QUEUE_FULL",
  /** No behavior pack is connected to the bridge. */
  "BRIDGE_DISCONNECTED",
  /** A request or command payload failed schema validation. */
  "INVALID_INPUT",
  /** The behavior pack reported a failure while executing a command. */
  "BEHAVIOR_PACK_ERROR",
  /** A `.mcstructure` filesystem operation failed. */
  "STRUCTURE_FILE_ERROR",
  /** The behavior pack speaks an incompatible bridge protocol version. */
  "PROTOCOL_MISMATCH",
  /** The connected behavior pack lacks a capability the tool requires. */
  "UNSUPPORTED_CAPABILITY",
  /** A referenced entity, structure, or other resource does not exist. */
  "NOT_FOUND",
  /** An unexpected internal error. */
  "INTERNAL",
] as const;

/** A stable error code. See {@link ERROR_CODES}. */
export type ErrorCode = (typeof ERROR_CODES)[number];

const ERROR_CODE_SET: ReadonlySet<string> = new Set<string>(ERROR_CODES);

/** Type guard: whether an arbitrary string is a known {@link ErrorCode}. */
export function isErrorCode(value: string): value is ErrorCode {
  return ERROR_CODE_SET.has(value);
}
