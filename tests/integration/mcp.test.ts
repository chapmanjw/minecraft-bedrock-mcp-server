import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { CLIENT_TOKEN, createTestHarness, type TestHarness } from "./harness.js";

describe("mcp surface", () => {
  let harness: TestHarness;
  let baseUrl: string;

  beforeAll(async () => {
    harness = createTestHarness();
    baseUrl = await harness.app.listen({ host: "127.0.0.1", port: 0 });
  });
  afterAll(async () => {
    await harness.close();
  });

  it("rejects an MCP request with no token", async () => {
    const response = await harness.app.inject({ method: "POST", url: "/mcp", payload: {} });
    expect(response.statusCode).toBe(401);
  });

  it("rejects an MCP request that is neither a session nor an initialize", async () => {
    const response = await harness.app.inject({
      method: "POST",
      url: "/mcp",
      headers: { authorization: `Bearer ${CLIENT_TOKEN}`, "content-type": "application/json" },
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("completes an initialize handshake for an authenticated client", async () => {
    const client = new Client({ name: "integration-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${CLIENT_TOKEN}` } },
    });
    try {
      await client.connect(transport);
      expect(client.getServerVersion()?.name).toBe("minecraft-bedrock-mcp-server");
    } finally {
      await client.close();
    }
  });
});
