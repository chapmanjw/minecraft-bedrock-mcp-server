import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { AGENT_TOKEN, CLIENT_TOKEN, createTestHarness, type TestHarness } from "./harness.js";

describe("mcp surface", () => {
  let harness: TestHarness;
  let baseUrl: string;
  let client: Client;

  beforeAll(async () => {
    harness = createTestHarness();
    baseUrl = await harness.app.listen({ host: "127.0.0.1", port: 0 });
    client = new Client({ name: "integration-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${CLIENT_TOKEN}` } },
    });
    await client.connect(transport);
  });
  afterAll(async () => {
    await client.close();
    await harness.close();
  });

  it("rejects an MCP request with no token", async () => {
    const response = await harness.app.inject({ method: "POST", url: "/mcp", payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it("rejects a request that is neither a session nor an initialize", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: `Bearer ${CLIENT_TOKEN}`, "content-type": "application/json" },
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("reports the server identity after the initialize handshake", () => {
    expect(client.getServerVersion()?.name).toBe("minecraft-bedrock-mcp-server");
  });

  it("lists the registered tools", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((tool) => tool.name);
    expect(names).toContain("mc_run_command");
    expect(names).toContain("mc_world_get_info");
    expect(names).toContain("mc_event_subscribe");
  });

  it("routes a tool call through the bridge and returns the result", async () => {
    const agentAuth = { authorization: `Bearer ${AGENT_TOKEN}` };
    // A first poll marks the behavior pack connected.
    await harness.app.inject({ method: "GET", url: "/bridge/poll", headers: agentAuth });

    const callPromise = client.callTool({
      name: "mc_run_command",
      arguments: { command: "say hello" },
    });

    // Act as the behavior pack: poll for the command, then post its result.
    let commandId: string | undefined;
    for (let attempt = 0; attempt < 20 && commandId === undefined; attempt += 1) {
      const poll = await harness.app.inject({
        method: "GET",
        url: "/bridge/poll",
        headers: agentAuth,
      });
      const body = poll.json<{ commands: { id: string; kind: string }[] }>();
      commandId = body.commands.find((command) => command.kind === "mc_run_command")?.id;
    }
    expect(commandId).toBeDefined();

    await harness.app.inject({
      method: "POST",
      url: "/bridge/result",
      headers: { ...agentAuth, "content-type": "application/json" },
      payload: { id: commandId ?? "", status: "ok", result: { output: "hello" } },
    });

    const result = await callPromise;
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ result: { output: "hello" } });
  });
});
