import { describe, expect, it } from "vitest";
import { BridgeEventSchema, EventReportSchema } from "../../src/protocol/event.js";

const VALID_SUBSCRIPTION = "sub_0123456789ABCDEFGHJKMNPQRS";

const validEvent = {
  subscription_id: VALID_SUBSCRIPTION,
  event_type: "playerJoin",
  occurred_at: "2026-05-15T12:00:00.000Z",
  payload: { playerName: "Steve" },
};

describe("BridgeEventSchema", () => {
  it("accepts a well-formed event", () => {
    expect(BridgeEventSchema.parse(validEvent)).toEqual(validEvent);
  });

  it("rejects a subscription id that is not a sub_<ULID>", () => {
    expect(BridgeEventSchema.safeParse({ ...validEvent, subscription_id: "sub_x" }).success).toBe(
      false,
    );
  });

  it("rejects an empty event_type", () => {
    expect(BridgeEventSchema.safeParse({ ...validEvent, event_type: "" }).success).toBe(false);
  });

  it("rejects a non-ISO occurred_at", () => {
    expect(BridgeEventSchema.safeParse({ ...validEvent, occurred_at: "now" }).success).toBe(false);
  });
});

describe("EventReportSchema", () => {
  it("accepts a batch of one event", () => {
    expect(EventReportSchema.safeParse({ events: [validEvent] }).success).toBe(true);
  });

  it("accepts a full batch of 256 events", () => {
    const events = Array.from({ length: 256 }, () => validEvent);
    expect(EventReportSchema.safeParse({ events }).success).toBe(true);
  });

  it("rejects an empty batch", () => {
    expect(EventReportSchema.safeParse({ events: [] }).success).toBe(false);
  });

  it("rejects a batch larger than 256 events", () => {
    const events = Array.from({ length: 257 }, () => validEvent);
    expect(EventReportSchema.safeParse({ events }).success).toBe(false);
  });
});
