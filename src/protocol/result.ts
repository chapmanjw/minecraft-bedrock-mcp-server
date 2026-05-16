import { z } from "zod";
import { CommandIdSchema } from "./command.js";

/**
 * An error reported by the behavior pack for a failed command.
 *
 * `code` is a free-form string at the protocol layer — the behavior pack may
 * report codes the server does not enumerate. The server narrows it to a known
 * {@link import("../errors/error-codes.js").ErrorCode} where possible.
 */
export const CommandErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string(),
  details: z.unknown().optional(),
});

/** An error reported by the behavior pack for a failed command. */
export type CommandError = z.infer<typeof CommandErrorSchema>;

/**
 * The result of a command, reported by the behavior pack via
 * `POST /bridge/result`.
 *
 * Modeled as a discriminated union on `status`: an `ok` result carries a
 * `result` payload and an `error` result carries an `error` — the two are
 * mutually exclusive by construction.
 */
export const CommandResultSchema = z.discriminatedUnion("status", [
  z.object({
    id: CommandIdSchema,
    status: z.literal("ok"),
    result: z.unknown(),
  }),
  z.object({
    id: CommandIdSchema,
    status: z.literal("error"),
    error: CommandErrorSchema,
  }),
]);

/** The result of a command, reported by the behavior pack. */
export type CommandResult = z.infer<typeof CommandResultSchema>;
