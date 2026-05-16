import { z } from "zod";

/**
 * Pattern for a command identifier: the literal `cmd_` followed by a 26-char
 * Crockford base32 ULID.
 */
export const COMMAND_ID_PATTERN = /^cmd_[0-9A-HJKMNP-TV-Z]{26}$/;

/** A command identifier, correlating a queued command with its result. */
export const CommandIdSchema = z
  .string()
  .regex(COMMAND_ID_PATTERN, "expected a cmd_<ULID> identifier");

/**
 * A single command delivered to the behavior pack via `GET /bridge/poll`.
 *
 * `payload` is intentionally opaque at the protocol layer; it is validated
 * against the originating MCP tool's input schema before the command is
 * enqueued.
 */
export const CommandSchema = z.object({
  /** Correlation identifier (`cmd_<ULID>`). */
  id: CommandIdSchema,
  /** Command kind — the MCP tool name, e.g. `mc_block_set`. */
  kind: z.string().min(1),
  /** Command arguments, validated per-kind at the tool layer. */
  payload: z.unknown(),
  /** ISO-8601 timestamp at which the server issued the command. */
  issued_at: z.string().datetime(),
  /** Milliseconds of execution budget remaining when the command was delivered. */
  deadline_ms: z.number().int().positive(),
});

/** A single command delivered to the behavior pack. */
export type Command = z.infer<typeof CommandSchema>;

/** The response envelope for `GET /bridge/poll`. */
export const PollResponseSchema = z.object({
  /** Commands to execute; empty when the long poll timed out. */
  commands: z.array(CommandSchema),
  /** ISO-8601 server timestamp, for behavior-pack clock-skew diagnostics. */
  server_time: z.string().datetime(),
});

/** The response envelope for `GET /bridge/poll`. */
export type PollResponse = z.infer<typeof PollResponseSchema>;
