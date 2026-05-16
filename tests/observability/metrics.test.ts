import { describe, expect, it } from "vitest";
import { createMetrics, type MetricsCollectors } from "../../src/observability/metrics.js";

const STATIC: MetricsCollectors = {
  queueDepth: () => 3,
  commandsInFlight: () => 1,
  bridgeConnected: () => true,
  mcpSessions: () => 2,
};

describe("metrics", () => {
  it("renders queue gauges sampled from the collectors", async () => {
    const metrics = createMetrics(STATIC);
    const text = await metrics.registry.metrics();
    expect(text).toContain("bridge_command_queue_depth 3");
    expect(text).toContain("bridge_commands_in_flight 1");
    expect(text).toContain("bridge_connected 1");
    expect(text).toContain("bridge_mcp_sessions 2");
  });

  it("counts HTTP requests by method and status", async () => {
    const metrics = createMetrics(STATIC);
    metrics.recordHttpRequest("GET", 200);
    metrics.recordHttpRequest("GET", 200);
    metrics.recordHttpRequest("POST", 401);
    const text = await metrics.registry.metrics();
    expect(text).toContain('bridge_http_requests_total{method="GET",status="200"} 2');
    expect(text).toContain('bridge_http_requests_total{method="POST",status="401"} 1');
  });

  it("records command outcomes by kind, status, and code", async () => {
    const metrics = createMetrics(STATIC);
    metrics.recordCommand({ kind: "mc_block_set", status: "ok", durationMs: 120 });
    metrics.recordCommand({
      kind: "mc_block_set",
      status: "error",
      code: "COMMAND_TIMEOUT",
      durationMs: 15_000,
    });
    const text = await metrics.registry.metrics();
    expect(text).toContain(
      'bridge_command_results_total{kind="mc_block_set",status="ok",code=""} 1',
    );
    expect(text).toContain(
      'bridge_command_results_total{kind="mc_block_set",status="error",code="COMMAND_TIMEOUT"} 1',
    );
  });
});
