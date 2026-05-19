# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm install             # install deps
npm run typecheck       # type-check without emit (tsconfig.json)
npm run lint            # ESLint
npm run format:check    # Prettier check
npm run format          # Prettier write
npm test                # vitest (run once)
npm run test:watch      # vitest (watch mode)
npm run build           # tsc → dist/ (tsconfig.build.json)
npm run dev             # tsx watch src/index.ts (hot-reload, no build needed)
npm start               # node dist/index.js (requires a prior build)
```

Run a single test file: `npx vitest run tests/queue/command-queue.test.ts`

The server can also be run via Docker — see `minecraft-local/docker-compose.yml` in the sibling repo.

## Architecture

This is the middle tier of a three-tier system:

```
MCP client (Claude, Cursor…)
  │ MCP Streamable HTTP  (BRIDGE_CLIENT_TOKEN)  →  POST /mcp
minecraft-bedrock-mcp-server              ← this repo  (Fastify, Node.js)
  │ HTTP long-poll        (BRIDGE_AGENT_TOKEN)  →  GET /bridge/poll
minecraft-bedrock-mcp-behavior-pack       ← sibling repo (runs inside BDS)
  │ Script API
Minecraft Bedrock world
```

### HTTP surface (`src/http/app.ts`)

Built on Fastify. Three authenticated route groups:

| Prefix     | Token                 | Consumers                     |
| ---------- | --------------------- | ----------------------------- |
| `/bridge`  | `BRIDGE_AGENT_TOKEN`  | behavior pack only            |
| `/mcp`     | `BRIDGE_CLIENT_TOKEN` | MCP clients (rate-limited)    |
| `/metrics` | `BRIDGE_CLIENT_TOKEN` | Prometheus scraper (optional) |

`GET /health` is unauthenticated. Two separate tokens enforce that the behavior pack cannot call MCP endpoints and MCP clients cannot call bridge endpoints.

### Command queue (`src/queue/command-queue.ts`)

The core concurrency primitive. MCP tool calls call `enqueueAndAwait` and suspend; the behavior pack drains via `dequeue` (long-poll) and reports results via `settle`. The queue tracks liveness — if no poll has been seen within `livenessWindowMs`, `enqueueAndAwait` fails with `BRIDGE_DISCONNECTED` rather than timing out.

Guards: per-kind throttle (`COMMAND_THROTTLED`), capacity cap (`QUEUE_FULL`), command deadlines (late results are silently dropped).

### MCP sessions (`src/mcp/session-manager.ts`)

Each MCP client connection gets its own `McpServer` instance + `StreamableHTTPServerTransport` pair. Sessions are cheap — tool handlers close over shared domain services (`CommandQueue`, `SubscriptionRegistry`, `StructureFileStore`). The session manager tracks all open sessions for graceful shutdown.

### Tools (`src/tools/`)

78 tools across 13 domain files assembled in `src/tools/index.ts`. Two kinds:

- **Bridge tools** (most): validate input, call `queue.enqueueAndAwait`, return the pack's result. Defined with `defineBridgeTool`.
- **Local tools** (6 `mc_structure_file_*` + `mc_event_poll` + `mc_event_list_subscriptions`): execute entirely on the MCP server — filesystem ops or subscription registry reads. Defined with `defineLocalTool`.

The split matters: local tools work even when no behavior pack is connected.

### Structure file store (`src/structures/structure-file-store.ts`)

Manages `.mcstructure` files in `BRIDGE_BEHAVIOR_PACK_PATH/structures/`. Writes are atomic (write-to-temp + rename) with EBUSY retry for Windows BDS compatibility.

### Event subscriptions (`src/events/subscription-registry.ts`)

Holds batched world events pushed by the behavior pack via `POST /bridge/event`. MCP clients poll via `mc_event_poll`. Each subscription buffers up to 512 events before dropping the oldest. Subscription state lives here — the behavior pack re-arms listeners after every script reload via `resync_subscriptions` in the handshake response.

### Configuration (`src/config/environment.ts`)

All config from environment variables, validated with Zod. Required: `BRIDGE_CLIENT_TOKEN`, `BRIDGE_AGENT_TOKEN`, `BRIDGE_WORLD_PATH`, `BRIDGE_BEHAVIOR_PACK_PATH`. See `.env.example` for all variables and defaults.

## Key constraints

- **Two tokens, two surfaces**: `BRIDGE_CLIENT_TOKEN` for MCP clients, `BRIDGE_AGENT_TOKEN` for the behavior pack. Never use the same value for both.
- **`BRIDGE_BEHAVIOR_PACK_PATH`** must point to the same folder the behavior pack is installed in — the MCP server writes `.mcstructure` files there and reads it for the structure file tools.
- **`BRIDGE_WORLD_PATH`** is a required env var but is not currently used at runtime (reserved for future tools that read world data directly).
- **No persistence**: the command queue, event buffers, and sessions are all in-memory. A server restart clears everything; the behavior pack re-handshakes automatically.
- **Protocol version**: implements bridge protocol `1.0.0`. Major version mismatch causes the behavior pack to refuse the connection.
