import { describe, expect, it } from "vitest";
import { HandshakeRequestSchema, HandshakeResponseSchema } from "../../src/protocol/handshake.js";

const VALID_SUBSCRIPTION = "sub_0123456789ABCDEFGHJKMNPQRS";

describe("HandshakeRequestSchema", () => {
  const base = {
    protocol_version: "1.0.0",
    behavior_pack_version: "0.1.0",
    script_modules: [{ name: "@minecraft/server", version: "2.6.0" }],
    world_id: "world-abc",
  };

  it("accepts a request without the optional minecraft version", () => {
    expect(HandshakeRequestSchema.parse(base)).toEqual(base);
  });

  it("accepts a request with the optional minecraft version", () => {
    const withVersion = { ...base, minecraft_version: "1.21.0" };
    expect(HandshakeRequestSchema.parse(withVersion)).toEqual(withVersion);
  });

  it("rejects a request missing the protocol version", () => {
    expect(
      HandshakeRequestSchema.safeParse({
        behavior_pack_version: "0.1.0",
        script_modules: [{ name: "@minecraft/server", version: "2.6.0" }],
        world_id: "world-abc",
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed script module entry", () => {
    expect(
      HandshakeRequestSchema.safeParse({ ...base, script_modules: [{ name: "@minecraft/server" }] })
        .success,
    ).toBe(false);
  });
});

describe("HandshakeResponseSchema", () => {
  it("accepts an acceptance response", () => {
    const response = {
      accepted: true,
      server_version: "0.1.0",
      protocol_version: "1.0.0",
      poll_timeout_ms: 30_000,
      resync_subscriptions: [{ subscription_id: VALID_SUBSCRIPTION, event_type: "playerJoin" }],
    };
    expect(HandshakeResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts a rejection response", () => {
    const response = {
      accepted: false,
      reason: "incompatible protocol version",
      server_protocol_version: "1.0.0",
    };
    expect(HandshakeResponseSchema.parse(response)).toEqual(response);
  });

  it("discriminates on the accepted flag", () => {
    expect(
      HandshakeResponseSchema.safeParse({ accepted: false, server_version: "0.1.0" }).success,
    ).toBe(false);
  });
});
