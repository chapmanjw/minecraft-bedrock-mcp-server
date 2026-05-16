import type { BridgeEvent } from "../protocol/index.js";
import { newSubscriptionId, type SubscriptionId } from "../queue/command-id.js";

/** An event held in a subscription's buffer, stamped with an ingest sequence. */
export interface BufferedEvent {
  readonly sequence: number;
  readonly event_type: string;
  readonly occurred_at: string;
  readonly payload: unknown;
}

/** A registered event subscription. */
export interface Subscription {
  readonly id: SubscriptionId;
  readonly eventType: string;
  readonly filter: unknown;
  readonly createdAt: string;
}

/** A subscription with its current buffer statistics. */
export interface SubscriptionSnapshot extends Subscription {
  readonly buffered: number;
  readonly lastSequence: number;
}

/** A page of buffered events plus an opaque cursor to resume after them. */
export interface EventPage {
  readonly events: readonly BufferedEvent[];
  readonly cursor: string;
}

/**
 * Tracks event subscriptions and buffers the events the behavior pack reports
 * for them. The MCP server owns the ordering cursor — events are stamped with
 * an ingest sequence here, not by the behavior pack.
 */
export interface SubscriptionRegistry {
  /** Registers a subscription and returns it. */
  create(eventType: string, filter: unknown): Subscription;
  /** Removes a subscription and its buffer; `false` if it did not exist. */
  remove(id: SubscriptionId): boolean;
  /** Returns a subscription by id. */
  get(id: SubscriptionId): Subscription | undefined;
  /** Lists every subscription with its buffer statistics. */
  list(): SubscriptionSnapshot[];
  /** Buffers an event under its subscription; `false` if the id is unknown. */
  ingest(event: BridgeEvent): boolean;
  /** Drains buffered events newer than `cursor` (omit to read from the start). */
  poll(id: SubscriptionId, cursor: string | undefined): EventPage;
}

/** Configuration for {@link createSubscriptionRegistry}. */
export interface SubscriptionRegistryOptions {
  /** Maximum events retained per subscription; the oldest are dropped when full. */
  readonly bufferSize: number;
  /** Notified after each ingested event — the seam for push notifications. */
  readonly onIngest?: (id: SubscriptionId) => void;
}

interface SubscriptionState {
  readonly subscription: Subscription;
  readonly buffer: BufferedEvent[];
  nextSequence: number;
}

/** Creates an empty {@link SubscriptionRegistry}. */
export function createSubscriptionRegistry(
  options: SubscriptionRegistryOptions,
): SubscriptionRegistry {
  const states = new Map<SubscriptionId, SubscriptionState>();

  function snapshot(state: SubscriptionState): SubscriptionSnapshot {
    return {
      ...state.subscription,
      buffered: state.buffer.length,
      lastSequence: state.nextSequence - 1,
    };
  }

  return {
    create(eventType, filter) {
      const subscription: Subscription = {
        id: newSubscriptionId(),
        eventType,
        filter,
        createdAt: new Date().toISOString(),
      };
      states.set(subscription.id, { subscription, buffer: [], nextSequence: 0 });
      return subscription;
    },

    remove(id) {
      return states.delete(id);
    },

    get(id) {
      return states.get(id)?.subscription;
    },

    list() {
      return [...states.values()].map(snapshot);
    },

    ingest(event) {
      const state = states.get(event.subscription_id);
      if (state === undefined) return false;
      state.buffer.push({
        sequence: state.nextSequence,
        event_type: event.event_type,
        occurred_at: event.occurred_at,
        payload: event.payload,
      });
      state.nextSequence += 1;
      if (state.buffer.length > options.bufferSize) {
        state.buffer.shift();
      }
      options.onIngest?.(event.subscription_id);
      return true;
    },

    poll(id, cursor) {
      const state = states.get(id);
      if (state === undefined) {
        return { events: [], cursor: cursor ?? "0" };
      }
      const after = cursor === undefined ? -1 : Number(cursor);
      const events = state.buffer.filter((event) => event.sequence > after);
      const last = events.at(-1);
      return {
        events,
        cursor: String(last === undefined ? Math.max(0, after) : last.sequence),
      };
    },
  };
}
