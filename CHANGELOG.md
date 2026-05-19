# Changelog

All notable changes to this project are documented in this file. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project adheres to
[Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.3.0] - 2026-05-18

Reworks the structure-upload feature from 0.2.0, which did not work on a
dedicated server. Pairs with [`minecraft-bedrock-mcp-behavior-pack`](https://github.com/chapmanjw/minecraft-bedrock-mcp-behavior-pack)
v0.3.0 — install both together.

### Added

- `mc_structure_create_from_blocks` — builds a saved structure from a
  run-length-encoded block grid: a block palette plus `[count, palette_index]`
  runs in ZYX order. The behavior pack builds it in-world as a world-saved
  structure, so it is immediately placeable with `mc_structure_place`,
  persists across reloads, and needs no world reload or filesystem access.

### Removed

- `mc_structure_upload`, `mc_server_reload_world`, the `.mcstructure` NBT
  encoder, and the `prismarine-nbt` dependency. The 0.2.0 upload tool wrote a
  `.mcstructure` file into the behavior pack and relied on `/reload all` to
  index it; on a Bedrock Dedicated Server that reload does not re-index
  structure files, and the host-side `definition_path` is unreachable from a
  remote client. `mc_structure_create_from_blocks` replaces it.

## [0.2.0] - 2026-05-18

Pairs with [`minecraft-bedrock-mcp-behavior-pack`](https://github.com/chapmanjw/minecraft-bedrock-mcp-behavior-pack)
v0.2.0 — install both together.

### Added

- `mc_structure_upload` tool — encodes a block-grid structure definition (a block palette plus
  a flat ZYX index array, supplied inline or as a host-side JSON file) into a `.mcstructure`
  file in the behavior pack's reserved `mcp/` namespace, then reloads the world so it can be
  placed as `mcp:<name>`. Lets a client materialize structures that are impractical to build
  block by block.
- `.mcstructure` encoder (`src/structures/mcstructure.ts`) — assembles the little-endian NBT
  structure file via `prismarine-nbt` and enforces the format's invariants.
- `mc_server_reload_world` tool — runs `/reload all`, re-indexing uploaded structure files and
  rejoining online players.

### Changed

- The structure-file store writes atomically — to a temporary file, then renamed into place,
  with an EBUSY retry — so a reader (or BDS) never observes a half-written `.mcstructure`.

## [0.1.0] - 2026-05-16

Initial release. Pairs with [`minecraft-bedrock-mcp-behavior-pack`](https://github.com/chapmanjw/minecraft-bedrock-mcp-behavior-pack)
v0.1.0 — install both together.

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

### Changed

- Tool results are serialized as TOON (Token-Oriented Object Notation) instead of
  pretty-printed JSON, and the redundant `structuredContent` copy is dropped — the
  payload is now carried once, in a single text block, to cut MCP client token usage.
