# Minecraft Bedrock MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that bridges MCP
clients — Claude and other AI agents — to a **Minecraft Bedrock Dedicated Server** (BDS). It
exposes the Bedrock Script API as MCP tools, so an agent can read and manipulate a live world
programmatically.

## How it works

The server runs on the same host as BDS and exposes two authenticated HTTP surfaces:

```
MCP clients (Claude, Cursor, ...)
   |  MCP over Streamable HTTP + bearer token
minecraft-bedrock-mcp-server
   |  HTTP long-poll + bearer token
BDS behavior pack  --  @minecraft/server Script API  --  the world
```

- The **`/mcp`** surface speaks the MCP Streamable HTTP transport to clients.
- The **`/bridge`** surface is long-polled by a companion **behavior pack** running inside the
  world.

An MCP tool call enqueues a command; the behavior pack polls for it, executes it through the
Script API, and posts the result back. The server correlates that result to the waiting tool
call and returns it to the client.

> The behavior pack is a separate repository. This repository is the MCP server only.

## Requirements

- Node.js 20 or newer
- A Minecraft Bedrock Dedicated Server with the companion behavior pack installed

## Install

```sh
npm install -g minecraft-bedrock-mcp-server
```

Run it directly without installing:

```sh
npx minecraft-bedrock-mcp-server
```

Or with Docker:

```sh
docker build -t bedrock-bridge .
docker run --env-file .env -p 8765:8765 bedrock-bridge
```

## Configuration

All configuration is through environment variables, validated at startup — the server exits
with a clear message if a required variable is missing. Copy [.env.example](.env.example) and
adjust.

| Variable                             | Default      | Description                                   |
| ------------------------------------ | ------------ | --------------------------------------------- |
| `BRIDGE_CLIENT_TOKEN`                | _(required)_ | Bearer token for MCP clients                  |
| `BRIDGE_AGENT_TOKEN`                 | _(required)_ | Bearer token for the behavior pack            |
| `BRIDGE_WORLD_PATH`                  | _(required)_ | Absolute path to the active world folder      |
| `BRIDGE_BEHAVIOR_PACK_PATH`          | _(required)_ | Absolute path to the behavior pack folder     |
| `BRIDGE_HOST`                        | `0.0.0.0`    | Bind address                                  |
| `BRIDGE_PORT`                        | `8765`       | Listen port                                   |
| `BRIDGE_TLS_CERT` / `BRIDGE_TLS_KEY` | _(none)_     | TLS cert/key paths — set both, or neither     |
| `BRIDGE_TRUST_PROXY`                 | `false`      | Trust `X-Forwarded-*` (enable behind a proxy) |
| `BRIDGE_LOG_LEVEL`                   | `info`       | Log level                                     |
| `BRIDGE_POLL_TIMEOUT_MS`             | `30000`      | Bridge long-poll hold time                    |
| `BRIDGE_COMMAND_TIMEOUT_MS`          | `15000`      | How long a tool call awaits a result          |
| `BRIDGE_RATE_LIMIT_RPM`              | `60`         | Per-token request rate on `/mcp`              |
| `BRIDGE_MAX_BODY_BYTES`              | `16777216`   | Maximum request body size                     |
| `BRIDGE_QUEUE_MAX`                   | `256`        | Maximum outstanding commands                  |
| `BRIDGE_METRICS_ENABLED`             | `false`      | Expose the Prometheus `/metrics` endpoint     |
| `BRIDGE_CORS_ORIGINS`                | _(none)_     | Comma-separated allowed CORS origins          |

## Endpoints

| Route                    | Auth         | Purpose                              |
| ------------------------ | ------------ | ------------------------------------ |
| `POST/GET/DELETE /mcp`   | client token | MCP Streamable HTTP transport        |
| `GET /bridge/poll`       | agent token  | Behavior-pack long-poll for commands |
| `POST /bridge/result`    | agent token  | Behavior-pack command results        |
| `POST /bridge/event`     | agent token  | Behavior-pack world events           |
| `POST /bridge/handshake` | agent token  | Behavior-pack version negotiation    |
| `GET /healthz`           | none         | Liveness probe                       |
| `GET /metrics`           | client token | Prometheus metrics (when enabled)    |

## TLS

The bridge carries bearer tokens and world data. **Use TLS** outside a fully trusted network.

### Direct TLS with mkcert (private LAN)

[mkcert](https://github.com/FiloSottile/mkcert) issues a certificate trusted by your LAN
machines:

```sh
mkcert -install
mkcert bedrock-host.lan 192.168.1.50
```

Point the server at the generated files:

```sh
BRIDGE_TLS_CERT=./bedrock-host.lan+1.pem
BRIDGE_TLS_KEY=./bedrock-host.lan+1-key.pem
```

When both are set, the server listens HTTPS only. When neither is set, it listens HTTP and
logs a prominent warning at startup.

### TLS at a reverse proxy

Alternatively, terminate TLS upstream — Caddy with its internal CA, or Traefik — and run this
server on plain HTTP bound to `localhost`. Set `BRIDGE_TRUST_PROXY=true` so client IP
addresses are logged correctly.

## Tool surface

77 tools across 13 domains, consistently named `mc_<domain>_<action>`:

| Domain          | Examples                                                          |
| --------------- | ----------------------------------------------------------------- |
| World           | `mc_world_get_info`, `mc_world_set_time`, `mc_world_set_weather`  |
| Blocks          | `mc_block_get`, `mc_block_fill`, `mc_block_clone`                 |
| Structures      | `mc_structure_create_from_world`, `mc_structure_place`            |
| Structure files | `mc_structure_file_read`, `mc_structure_file_write`               |
| Entities        | `mc_entity_spawn`, `mc_entity_teleport`, `mc_entity_apply_effect` |
| Players         | `mc_player_list`, `mc_player_give_item`, `mc_player_set_gamemode` |
| Inventory       | `mc_inventory_get`, `mc_inventory_set_slot`                       |
| Scoreboard      | `mc_scoreboard_set_score`, `mc_scoreboard_add_objective`          |
| Properties      | `mc_property_get`, `mc_property_set`                              |
| Effects         | `mc_explosion_create`, `mc_lightning_strike`                      |
| Events          | `mc_event_subscribe`, `mc_event_poll`                             |
| Server          | `mc_server_save_world`, `mc_server_get_status`                    |
| Escape hatch    | `mc_run_command`                                                  |

## Stability and versioning

This server is a stable foundation for separately built skills and plugins. Its **public
contract**, governed by semantic versioning, is:

- tool **names**,
- tool **input schemas**,
- tool **output** (the `result` field of the response envelope),
- stable **error codes**,
- the **bridge protocol** envelopes.

Internal structure — the HTTP framework, module layout, logging format — is not part of the
contract and may change at any time. The bridge protocol is versioned independently; its major
version is negotiated at handshake.

## Security

- Two separate bearer tokens isolate MCP clients from the behavior pack; tokens are compared
  in constant time.
- Every route except `/healthz` requires a token.
- Per-token rate limiting on `/mcp`; per-command throttling protects the BDS script watchdog.
- The command queue is in memory and is not persisted — commands do not survive a restart.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Development

```sh
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

## License

MIT — see [LICENSE](LICENSE).
