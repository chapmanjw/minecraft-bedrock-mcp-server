# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

- Bridge protocol — `zod` schemas and inferred types for the command, result, event, and
  handshake envelopes, with an independently versioned `PROTOCOL_VERSION`.
- In-memory command queue with correlated results, per-kind throttling, long-poll dequeue,
  behavior-pack liveness tracking, and graceful shutdown.
- HTTP transport built on Fastify — the `/mcp` MCP Streamable HTTP surface for clients and
  the `/bridge` surface for the behavior pack, each authenticated with its own bearer token.
- TLS support via `BRIDGE_TLS_CERT` / `BRIDGE_TLS_KEY`, with a reverse-proxy alternative.
- The full MCP tool surface — 77 tools across world, blocks, structures, structure files,
  entities, players, inventory, scoreboard, dynamic properties, effects, events, server
  administration, and a raw-command escape hatch.
- Subscription registry and structure-file store backing the event and filesystem tools.
- Optional Prometheus `/metrics` endpoint, enabled with `BRIDGE_METRICS_ENABLED`.
- `Dockerfile` for containerized deployment and a CI workflow.
