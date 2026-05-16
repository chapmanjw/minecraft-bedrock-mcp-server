import { z } from "zod";
import { SubscriptionIdSchema } from "./event.js";

/** A Script API module the behavior pack depends on, e.g. `@minecraft/server`. */
export const ScriptModuleSchema = z.object({
  name: z.string().min(1),
  version: z.string().min(1),
});

/** A Script API module the behavior pack depends on. */
export type ScriptModule = z.infer<typeof ScriptModuleSchema>;

/**
 * The request envelope for `POST /bridge/handshake`.
 *
 * Sent by the behavior pack on startup. The reported Script API module
 * versions drive server-side capability negotiation, so tools that require an
 * unavailable capability can fail fast with a clear error.
 */
export const HandshakeRequestSchema = z.object({
  /** Bridge protocol version the behavior pack implements. */
  protocol_version: z.string().min(1),
  /** Version of the behavior pack itself. */
  behavior_pack_version: z.string().min(1),
  /** Minecraft / BDS version, when the behavior pack can determine it. */
  minecraft_version: z.string().min(1).optional(),
  /** Script API modules and versions the behavior pack imports. */
  script_modules: z.array(ScriptModuleSchema),
  /** Stable identifier of the world the behavior pack is running in. */
  world_id: z.string().min(1),
});

/** The request envelope for `POST /bridge/handshake`. */
export type HandshakeRequest = z.infer<typeof HandshakeRequestSchema>;

/**
 * A subscription the server asks the behavior pack to re-arm.
 *
 * A behavior pack restart loses its Script API subscriptions; the handshake
 * response replays the still-active ones so events resume without client
 * involvement.
 */
export const ResyncSubscriptionSchema = z.object({
  subscription_id: SubscriptionIdSchema,
  event_type: z.string().min(1),
  filter: z.unknown().optional(),
});

/** A subscription the server asks the behavior pack to re-arm. */
export type ResyncSubscription = z.infer<typeof ResyncSubscriptionSchema>;

/**
 * The response envelope for `POST /bridge/handshake`.
 *
 * A discriminated union on `accepted`: the server refuses a behavior pack
 * whose bridge protocol major version is incompatible.
 */
export const HandshakeResponseSchema = z.discriminatedUnion("accepted", [
  z.object({
    accepted: z.literal(true),
    /** Version of this MCP server. */
    server_version: z.string(),
    /** Bridge protocol version this server implements. */
    protocol_version: z.string(),
    /** Long-poll timeout the behavior pack should use for `GET /bridge/poll`. */
    poll_timeout_ms: z.number().int().positive(),
    /** Subscriptions to re-arm after a behavior-pack restart. */
    resync_subscriptions: z.array(ResyncSubscriptionSchema),
  }),
  z.object({
    accepted: z.literal(false),
    /** Human-readable reason the connection was refused. */
    reason: z.string(),
    /** Bridge protocol version this server implements, for diagnostics. */
    server_protocol_version: z.string(),
  }),
]);

/** The response envelope for `POST /bridge/handshake`. */
export type HandshakeResponse = z.infer<typeof HandshakeResponseSchema>;
