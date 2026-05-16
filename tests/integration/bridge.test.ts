import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AGENT_TOKEN, CLIENT_TOKEN, createTestHarness, type TestHarness } from "./harness.js";

const SUBSCRIPTION_ID = "sub_0123456789ABCDEFGHJKMNPQRS";

describe("bridge surface", () => {
  let harness: TestHarness;
  const agentAuth = { authorization: `Bearer ${AGENT_TOKEN}`, "content-type": "application/json" };

  beforeAll(async () => {
    harness = createTestHarness();
    await harness.app.ready();
  });
  afterAll(async () => {
    await harness.close();
  });

  it("serves /healthz without authentication", async () => {
    const response = await harness.app.inject({ method: "GET", url: "/healthz" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: "ok", bridge_connected: false });
  });

  it("rejects a bridge request with no token", async () => {
    const response = await harness.app.inject({ method: "GET", url: "/bridge/poll" });
    expect(response.statusCode).toBe(401);
  });

  it("rejects a bridge request bearing the client token", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: "/bridge/poll",
      headers: { authorization: `Bearer ${CLIENT_TOKEN}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it("rejects a malformed authorization header", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: "/bridge/poll",
      headers: { authorization: `Basic ${AGENT_TOKEN}` },
    });
    expect(response.statusCode).toBe(401);
  });

  it("returns an empty batch when the poll finds no commands", async () => {
    const response = await harness.app.inject({
      method: "GET",
      url: "/bridge/poll",
      headers: { authorization: `Bearer ${AGENT_TOKEN}` },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ commands: [] });
  });

  it("delivers an enqueued command and settles it end to end", async () => {
    // A first poll marks the behavior pack connected.
    await harness.app.inject({
      method: "GET",
      url: "/bridge/poll",
      headers: { authorization: `Bearer ${AGENT_TOKEN}` },
    });

    const resultPromise = harness.queue.enqueueAndAwait({
      kind: "mc_world_get_info",
      payload: { sample: true },
      correlationId: "test-correlation",
      timeoutMs: 5_000,
    });

    const polled = await harness.app.inject({
      method: "GET",
      url: "/bridge/poll",
      headers: { authorization: `Bearer ${AGENT_TOKEN}` },
    });
    expect(polled.statusCode).toBe(200);
    const body = polled.json<{ commands: { id: string; kind: string }[] }>();
    expect(body.commands).toHaveLength(1);
    expect(body.commands[0]?.kind).toBe("mc_world_get_info");
    const commandId = body.commands[0]?.id ?? "";

    const settled = await harness.app.inject({
      method: "POST",
      url: "/bridge/result",
      headers: agentAuth,
      payload: { id: commandId, status: "ok", result: { worldName: "Test World" } },
    });
    expect(settled.statusCode).toBe(202);

    await expect(resultPromise).resolves.toEqual({
      id: commandId,
      status: "ok",
      result: { worldName: "Test World" },
    });
  });

  it("rejects a malformed command result", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/bridge/result",
      headers: agentAuth,
      payload: { id: "not-a-command-id", status: "ok" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("accepts a behavior pack with a compatible protocol version", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/bridge/handshake",
      headers: agentAuth,
      payload: {
        protocol_version: "1.4.2",
        behavior_pack_version: "0.1.0",
        script_modules: [{ name: "@minecraft/server", version: "2.6.0" }],
        world_id: "world-test",
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ accepted: true });
  });

  it("refuses a behavior pack with an incompatible protocol version", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/bridge/handshake",
      headers: agentAuth,
      payload: {
        protocol_version: "2.0.0",
        behavior_pack_version: "0.1.0",
        script_modules: [],
        world_id: "world-test",
      },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toMatchObject({ accepted: false });
  });

  it("accepts a batch of events", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/bridge/event",
      headers: agentAuth,
      payload: {
        events: [
          {
            subscription_id: SUBSCRIPTION_ID,
            event_type: "playerJoin",
            occurred_at: "2026-05-15T12:00:00.000Z",
            payload: { playerName: "Steve" },
          },
        ],
      },
    });
    expect(response.statusCode).toBe(202);
  });

  it("rejects a malformed event report", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/bridge/event",
      headers: agentAuth,
      payload: { events: [] },
    });
    expect(response.statusCode).toBe(400);
  });
});
