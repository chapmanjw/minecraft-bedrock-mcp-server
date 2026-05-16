import { z } from "zod";

/**
 * Pattern for a subscription identifier: the literal `sub_` followed by a
 * 26-char Crockford base32 ULID.
 */
export const SUBSCRIPTION_ID_PATTERN = /^sub_[0-9A-HJKMNP-TV-Z]{26}$/;

/** A subscription identifier, issued by `mc_event_subscribe`. */
export const SubscriptionIdSchema = z
  .string()
  .regex(SUBSCRIPTION_ID_PATTERN, "expected a sub_<ULID> identifier");

/**
 * A world event observed by the behavior pack for an active subscription.
 *
 * The behavior pack does not assign an ordering cursor; the server stamps an
 * ingest sequence as it buffers events, so `mc_event_poll` cursors stay under
 * server control.
 */
export const BridgeEventSchema = z.object({
  /** The subscription this event belongs to. */
  subscription_id: SubscriptionIdSchema,
  /** Event type, e.g. `playerJoin` or `blockBreak`. */
  event_type: z.string().min(1),
  /** ISO-8601 timestamp at which the event occurred in-world. */
  occurred_at: z.string().datetime(),
  /** Event-specific data. */
  payload: z.unknown(),
});

/** A world event observed by the behavior pack. */
export type BridgeEvent = z.infer<typeof BridgeEventSchema>;

/**
 * The request envelope for `POST /bridge/event`.
 *
 * Events are batched: behavior packs fire bursts (e.g. `blockBreak`), and one
 * HTTP request per event would overwhelm the bridge.
 */
export const EventReportSchema = z.object({
  events: z.array(BridgeEventSchema).min(1).max(256),
});

/** The request envelope for `POST /bridge/event`. */
export type EventReport = z.infer<typeof EventReportSchema>;
