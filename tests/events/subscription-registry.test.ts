import { describe, expect, it } from "vitest";
import { createSubscriptionRegistry } from "../../src/events/subscription-registry.js";
import type { BridgeEvent } from "../../src/protocol/index.js";

function eventFor(subscriptionId: string, type = "playerJoin"): BridgeEvent {
  return {
    subscription_id: subscriptionId,
    event_type: type,
    occurred_at: "2026-05-15T12:00:00.000Z",
    payload: { sample: true },
  };
}

describe("subscription registry", () => {
  it("creates a subscription with a sub_ id", () => {
    const registry = createSubscriptionRegistry({ bufferSize: 10 });
    const subscription = registry.create("playerJoin", null);
    expect(subscription.id).toMatch(/^sub_/);
    expect(registry.get(subscription.id)).toEqual(subscription);
  });

  it("lists subscriptions with buffer statistics", () => {
    const registry = createSubscriptionRegistry({ bufferSize: 10 });
    const subscription = registry.create("blockBreak", { dimension: "overworld" });
    registry.ingest(eventFor(subscription.id));
    const [snapshot] = registry.list();
    expect(snapshot).toMatchObject({ id: subscription.id, eventType: "blockBreak", buffered: 1 });
  });

  it("reports ingest for an unknown subscription as false", () => {
    const registry = createSubscriptionRegistry({ bufferSize: 10 });
    expect(registry.ingest(eventFor("sub_unknown"))).toBe(false);
  });

  it("drains buffered events and advances the cursor", () => {
    const registry = createSubscriptionRegistry({ bufferSize: 10 });
    const subscription = registry.create("chatSend", null);
    registry.ingest(eventFor(subscription.id));
    registry.ingest(eventFor(subscription.id));

    const first = registry.poll(subscription.id, undefined);
    expect(first.events).toHaveLength(2);

    registry.ingest(eventFor(subscription.id));
    const second = registry.poll(subscription.id, first.cursor);
    expect(second.events).toHaveLength(1);
    expect(second.events[0]?.sequence).toBe(2);
  });

  it("drops the oldest events when the buffer is full", () => {
    const registry = createSubscriptionRegistry({ bufferSize: 3 });
    const subscription = registry.create("entityHurt", null);
    for (let i = 0; i < 5; i += 1) {
      registry.ingest(eventFor(subscription.id));
    }
    const page = registry.poll(subscription.id, undefined);
    expect(page.events).toHaveLength(3);
    expect(page.events[0]?.sequence).toBe(2);
  });

  it("removes a subscription and its buffer", () => {
    const registry = createSubscriptionRegistry({ bufferSize: 10 });
    const subscription = registry.create("playerLeave", null);
    expect(registry.remove(subscription.id)).toBe(true);
    expect(registry.get(subscription.id)).toBeUndefined();
    expect(registry.remove(subscription.id)).toBe(false);
  });
});
