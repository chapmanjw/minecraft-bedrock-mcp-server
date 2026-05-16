import { Counter, Gauge, Histogram, Registry } from "prom-client";

/** A completed bridge command, observed for metrics. */
export interface CommandObservation {
  readonly kind: string;
  readonly status: "ok" | "error";
  readonly code?: string;
  readonly durationMs: number;
}

/** Live values the queue gauges read at scrape time. */
export interface MetricsCollectors {
  readonly queueDepth: () => number;
  readonly commandsInFlight: () => number;
  readonly bridgeConnected: () => boolean;
  readonly mcpSessions: () => number;
}

/** Records server events and renders the Prometheus exposition. */
export interface Metrics {
  /** The Prometheus registry, rendered by the `/metrics` route. */
  readonly registry: Registry;
  /** Records a completed HTTP request. */
  recordHttpRequest(method: string, statusCode: number): void;
  /** Records a completed bridge command. */
  recordCommand(observation: CommandObservation): void;
}

/** Creates a {@link Metrics} façade backed by a private Prometheus registry. */
export function createMetrics(collectors: MetricsCollectors): Metrics {
  const registry = new Registry();

  const httpRequests = new Counter({
    name: "bridge_http_requests_total",
    help: "Total HTTP requests by method and response status.",
    labelNames: ["method", "status"],
    registers: [registry],
  });
  const commandDuration = new Histogram({
    name: "bridge_command_duration_seconds",
    help: "Bridge command round-trip duration by kind and status.",
    labelNames: ["kind", "status"],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15],
    registers: [registry],
  });
  const commandResults = new Counter({
    name: "bridge_command_results_total",
    help: "Bridge command outcomes by kind, status, and error code.",
    labelNames: ["kind", "status", "code"],
    registers: [registry],
  });

  // Gauges sample live state through the collectors when the registry is scraped.
  const _queueDepth = new Gauge({
    name: "bridge_command_queue_depth",
    help: "Commands enqueued but not yet dequeued.",
    registers: [registry],
    collect() {
      this.set(collectors.queueDepth());
    },
  });
  const _commandsInFlight = new Gauge({
    name: "bridge_commands_in_flight",
    help: "Commands dequeued but not yet settled.",
    registers: [registry],
    collect() {
      this.set(collectors.commandsInFlight());
    },
  });
  const _bridgeConnected = new Gauge({
    name: "bridge_connected",
    help: "Whether a behavior pack is connected (1) or not (0).",
    registers: [registry],
    collect() {
      this.set(collectors.bridgeConnected() ? 1 : 0);
    },
  });
  const _mcpSessions = new Gauge({
    name: "bridge_mcp_sessions",
    help: "Open MCP client sessions.",
    registers: [registry],
    collect() {
      this.set(collectors.mcpSessions());
    },
  });
  return {
    registry,
    recordHttpRequest(method, statusCode) {
      httpRequests.inc({ method, status: String(statusCode) });
    },
    recordCommand(observation) {
      commandDuration.observe(
        { kind: observation.kind, status: observation.status },
        observation.durationMs / 1000,
      );
      commandResults.inc({
        kind: observation.kind,
        status: observation.status,
        code: observation.code ?? "",
      });
    },
  };
}
