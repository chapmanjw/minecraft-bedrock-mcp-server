<p align="center">
  <img src="docs/images/logo.png" width="200" alt="Minecraft Bedrock MCP Server logo">
</p>

# Minecraft Bedrock MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io) (MCP) server that bridges MCP
clients — Claude and other AI agents — to a **Minecraft Bedrock Dedicated Server** (BDS). It
exposes the Bedrock Script API as MCP tools, so an agent can read and manipulate a live world
programmatically.

## ⚠️ Built on an experimental API

This project depends on Mojang's Bedrock **Script API**, including the **beta** modules
`@minecraft/server-net` and `@minecraft/server-admin`. The Script API is an evolving surface that
Mojang revises between Minecraft versions, and **a Bedrock update can change, deprecate, or remove
APIs this project depends on** — beta modules can be discontinued outright with no stable
replacement. Pin your BDS to a known-good version, do not auto-update it, and keep the BDS, the
behavior pack, and this server upgraded together. Treat the whole stack as experimental.

## The three repositories

This system is split across three repositories:

| Repository                                                                                                    | Role                                                                                    |
| ------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **`minecraft-bedrock-mcp-server`** (this repo)                                                                | The MCP server. Speaks MCP to clients and bridges commands to the world.                |
| **[`minecraft-bedrock-mcp-behavior-pack`](https://github.com/chapmanjw/minecraft-bedrock-mcp-behavior-pack)** | The BDS behavior pack. Runs inside the world and executes commands via the Script API.  |
| **[`minecraft-bedrock-claude-plugin`](https://github.com/chapmanjw/minecraft-bedrock-claude-plugin)**         | A Claude Code plugin — skills that guide this setup and agents that build in the world. |

The first two repositories are required. This README is the **end-to-end guide** — it covers
standing up the whole stack. The behavior pack repository documents the pack itself in more
depth. The Claude plugin is optional but recommended: it turns the tutorial below into a
guided, step-by-step experience and adds a builder agent for designing and constructing things
in the world.

## How it works

The server runs on the same host as BDS and exposes two authenticated HTTP surfaces:

```
MCP clients (Claude Desktop, Cursor, ...)
   |  MCP over Streamable HTTP + bearer token
minecraft-bedrock-mcp-server                  <-- this repository
   |  HTTP long-poll + bearer token
Bedrock Bridge behavior pack                  <-- separate repository
   |  @minecraft/server Script API
the Minecraft world
```

- The **`/mcp`** surface speaks the MCP Streamable HTTP transport to clients.
- The **`/bridge`** surface is long-polled by the companion behavior pack running inside the world.

An MCP tool call enqueues a command; the behavior pack polls for it, executes it through the
Script API, and posts the result back. The server correlates that result to the waiting tool call
and returns it to the client.

---

# End-to-end setup tutorial

This walkthrough takes you from nothing to an AI agent building in your world. It has eight steps:

1. [Set up a Bedrock Dedicated Server](#step-1--set-up-a-bedrock-dedicated-server)
2. [Create a compatible world](#step-2--create-a-compatible-world)
3. [Transfer the world to the server](#step-3--transfer-the-world-to-the-server)
4. [Install the behavior pack](#step-4--install-the-behavior-pack)
5. [Install and configure the MCP server](#step-5--install-and-configure-the-mcp-server)
6. [Configure the behavior pack](#step-6--configure-the-behavior-pack)
7. [Start everything](#step-7--start-everything)
8. [Connect Claude Desktop](#step-8--connect-claude-desktop)

> **Assumption:** this tutorial assumes the Bedrock Dedicated Server and the MCP server run on the
> **same Ubuntu (Linux) host**. The commands below are written for Ubuntu. BDS also ships for
> Windows; if you run it there, adapt the paths and shell commands accordingly — the configuration
> values are identical.

> **Prefer a guided setup?** The
> [`minecraft-bedrock-claude-plugin`](https://github.com/chapmanjw/minecraft-bedrock-claude-plugin)
> turns these eight steps into an interactive walkthrough inside Claude Code — its
> `minecraft-mcp-setup` agent runs the whole sequence with you, on Linux or Windows. The manual
> tutorial below remains the canonical reference.

## Prerequisites

- An Ubuntu host (a VM, a spare machine, or a cloud instance) for the server.
- Node.js 20 or newer on that host.
- A copy of **Minecraft: Bedrock Edition** on a PC or device — used once to create the world.
- About 20 minutes.

## Step 1 — Set up a Bedrock Dedicated Server

1. Download the Linux Bedrock Dedicated Server from the official page:
   <https://www.minecraft.net/en-us/download/server/bedrock>. Accept the EULA and privacy policy
   prompts on that page to reveal the download link.

2. Unzip it on the Ubuntu host:

   ```sh
   sudo mkdir -p /opt/bedrock-server
   sudo unzip bedrock-server-*.zip -d /opt/bedrock-server
   sudo chown -R "$USER" /opt/bedrock-server
   cd /opt/bedrock-server
   ```

3. Do a first test run so BDS generates its default files, then stop it with `Ctrl+C`:

   ```sh
   LD_LIBRARY_PATH=. ./bedrock_server
   ```

   If it complains about a missing library, install the basics:
   `sudo apt-get update && sudo apt-get install -y libcurl4 unzip`.

4. Edit `server.properties`. The settings that matter for this project:

   | Setting        | Value                    | Why                                                     |
   | -------------- | ------------------------ | ------------------------------------------------------- |
   | `level-name`   | _your world folder name_ | Selects which world under `worlds/` to load.            |
   | `allow-cheats` | `true`                   | Required for `mc_run_command` and command-backed tools. |
   | `gamemode`     | `creative`               | Recommended so agents can place and break freely.       |

   Leave the rest at their defaults for now. You will set `level-name` in Step 3.

Step 7 covers running BDS as a `systemd` service. For more detail (firewall rules, backups),
search "Bedrock Dedicated Server" in the Minecraft help center at <https://help.minecraft.net>.

## Step 2 — Create a compatible world

The behavior pack needs a world created with the **Beta APIs** experiment enabled. That toggle can
only be set when the world is created **in the Minecraft client** — the dedicated server cannot
turn it on. So create the world on your PC/device first, then move it to the server.

In Minecraft: Bedrock Edition, choose **Create New World** and set:

| Setting                      | Value    | Why                                                                |
| ---------------------------- | -------- | ------------------------------------------------------------------ |
| **Game Mode**                | Creative | Agents place/break blocks and spawn entities freely.               |
| **Cheats** (Activate Cheats) | On       | Enables commands; pairs with `allow-cheats` on the server.         |
| **Experiments → Beta APIs**  | On       | **Required.** `@minecraft/server-net` / `-admin` are beta modules. |

Then **play the world once** for a few seconds so it is fully written to disk, and exit.

## Step 3 — Transfer the world to the server

1. In Minecraft, on the worlds list, open the world's settings (the pencil icon) and choose
   **Export World**. This produces a `.mcworld` file — which is just a ZIP archive.

2. Copy that file to the Ubuntu host (e.g. with `scp`) and unzip it into a folder under `worlds/`:

   ```sh
   cd /opt/bedrock-server/worlds
   mkdir "mcp-world"
   unzip ~/exported-world.mcworld -d "mcp-world"
   ```

3. Set `level-name=mcp-world` in `/opt/bedrock-server/server.properties` so BDS loads it.

The world's absolute path is now `/opt/bedrock-server/worlds/mcp-world` — you will need it shortly.

## Step 4 — Install the behavior pack

1. Get the pack from the
   [behavior pack repository](https://github.com/chapmanjw/minecraft-bedrock-mcp-behavior-pack) —
   download `bedrock-bridge.mcpack` from its
   [Releases](https://github.com/chapmanjw/minecraft-bedrock-mcp-behavior-pack/releases), or clone
   and `npm run build` it. The pack is the folder holding `manifest.json`, `scripts/main.js`, and
   `pack_icon.png`.

2. Place the pack folder inside the world:

   ```sh
   mkdir -p "/opt/bedrock-server/worlds/mcp-world/behavior_packs"
   cp -r bedrock-bridge "/opt/bedrock-server/worlds/mcp-world/behavior_packs/"
   ```

3. Activate it for the world by creating (or editing)
   `/opt/bedrock-server/worlds/mcp-world/world_behavior_packs.json`:

   ```json
   [{ "pack_id": "fa013817-66f2-4a5f-a724-1347f912bd40", "version": [0, 3, 0] }]
   ```

The pack's absolute path is now
`/opt/bedrock-server/worlds/mcp-world/behavior_packs/bedrock-bridge`.

## Step 5 — Install and configure the MCP server

Install this server on the same host:

```sh
npm install -g minecraft-bedrock-mcp-server
```

Generate two long random secrets — one for MCP clients, one for the behavior pack:

```sh
openssl rand -hex 32   # use for BRIDGE_CLIENT_TOKEN
openssl rand -hex 32   # use for BRIDGE_AGENT_TOKEN
```

Create a `.env` file (copy [.env.example](.env.example) as a starting point):

```sh
BRIDGE_CLIENT_TOKEN=<first secret>
BRIDGE_AGENT_TOKEN=<second secret>
BRIDGE_WORLD_PATH=/opt/bedrock-server/worlds/mcp-world
BRIDGE_BEHAVIOR_PACK_PATH=/opt/bedrock-server/worlds/mcp-world/behavior_packs/bedrock-bridge
BRIDGE_HOST=0.0.0.0
BRIDGE_PORT=8765
```

See the [configuration reference](#configuration-reference) for every variable.

## Step 6 — Configure the behavior pack

The pack reads its configuration from the BDS scripting config directory. Create
`/opt/bedrock-server/config/default/` and add three files (the behavior pack repository ships
copy-ready versions under its `config/default/`):

**`permissions.json`** — lets the pack load its Script API modules:

```json
{
  "allowed_modules": ["@minecraft/server", "@minecraft/server-net", "@minecraft/server-admin"]
}
```

**`variables.json`** — where the bridge listens (the MCP server's `/bridge` surface):

```json
{ "bridge_url": "http://localhost:8765" }
```

**`secrets.json`** — the bridge token. The value is the **full `Authorization` header** — the word
`Bearer`, a space, then the `BRIDGE_AGENT_TOKEN` from your `.env`:

```json
{ "bridge_agent_token": "Bearer <the BRIDGE_AGENT_TOKEN second secret>" }
```

> The `Bearer ` prefix must be part of the stored secret — the pack receives an opaque handle it
> cannot read or concatenate, so the scheme prefix has to travel inside the secret itself.

## Step 7 — Start everything

You can start the two processes by hand, or — recommended — install them as `systemd` services so
they survive logout, restart on crash, and start at boot.

### Option A — run in the foreground

Start the MCP server, then the Bedrock server, in two terminals:

```sh
# Terminal 1 — the MCP server
minecraft-bedrock-mcp-server          # reads .env from the working directory

# Terminal 2 — the Bedrock Dedicated Server
cd /opt/bedrock-server && LD_LIBRARY_PATH=. ./bedrock_server
```

### Option B — run as systemd services (recommended)

This is how the two processes are run in a typical long-lived deployment.

1. Create a dedicated unprivileged user to own and run both processes, and hand it the files:

   ```sh
   sudo useradd --system --no-create-home --shell /usr/sbin/nologin minecraft
   sudo chown -R minecraft:minecraft /opt/bedrock-server
   ```

2. Move the MCP server's `.env` (from Step 5) somewhere the service can read it, and lock it down
   — it holds both bearer tokens:

   ```sh
   sudo mkdir -p /etc/minecraft-bedrock-mcp
   sudo cp .env /etc/minecraft-bedrock-mcp/.env
   sudo chown -R minecraft:minecraft /etc/minecraft-bedrock-mcp
   sudo chmod 600 /etc/minecraft-bedrock-mcp/.env
   ```

3. Create `/etc/systemd/system/bedrock-server.service`:

   ```ini
   [Unit]
   Description=Minecraft Bedrock Dedicated Server
   After=network.target

   [Service]
   Type=simple
   User=minecraft
   Group=minecraft
   WorkingDirectory=/opt/bedrock-server
   Environment=LD_LIBRARY_PATH=/opt/bedrock-server
   ExecStart=/opt/bedrock-server/bedrock_server
   Restart=on-failure
   RestartSec=10
   StandardInput=null
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

4. Create `/etc/systemd/system/mc-mcp-server.service`:

   ```ini
   [Unit]
   Description=Minecraft Bedrock MCP server
   After=network.target bedrock-server.service

   [Service]
   Type=simple
   User=minecraft
   Group=minecraft
   EnvironmentFile=/etc/minecraft-bedrock-mcp/.env
   ExecStart=/usr/bin/minecraft-bedrock-mcp-server
   Restart=on-failure
   RestartSec=10
   StandardOutput=journal
   StandardError=journal

   [Install]
   WantedBy=multi-user.target
   ```

   `ExecStart` points at the global install from Step 5. Run `command -v minecraft-bedrock-mcp-server`
   to confirm its path on your host and adjust the line if it differs.

5. Enable and start both — the MCP server first, so the bridge is listening when the world loads:

   ```sh
   sudo systemctl daemon-reload
   sudo systemctl enable --now mc-mcp-server bedrock-server
   ```

6. Check status and follow the logs:

   ```sh
   systemctl status mc-mcp-server bedrock-server
   journalctl -u mc-mcp-server -f
   ```

### Confirm the handshake

When the world loads, the behavior pack handshakes with the bridge. The MCP server logs the
successful handshake, and BDS logs that the `bedrock-bridge` pack's script started. If the
handshake fails, the most common causes are a token mismatch between `secrets.json` and `.env`, or
a wrong `bridge_url`.

Quick liveness check:

```sh
curl http://localhost:8765/healthz
```

## Step 8 — Connect Claude Desktop

The MCP server speaks the **Streamable HTTP** transport. Claude Desktop connects to it through the
[`mcp-remote`](https://www.npmjs.com/package/mcp-remote) adapter, which bridges a local stdio
server entry to a remote HTTP endpoint and attaches the bearer token.

Edit Claude Desktop's config file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

Add a `minecraft-bedrock` entry under `mcpServers`:

```json
{
  "mcpServers": {
    "minecraft-bedrock": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://YOUR-SERVER-HOST:8765/mcp",
        "--header",
        "Authorization:${AUTH_HEADER}"
      ],
      "env": {
        "AUTH_HEADER": "Bearer <the BRIDGE_CLIENT_TOKEN first secret>"
      }
    }
  }
}
```

Replace `YOUR-SERVER-HOST` with the host running the MCP server (`localhost` if it is the same
machine as Claude Desktop). The token is passed via the `AUTH_HEADER` env var so its space is not
mangled by argument parsing.

Restart Claude Desktop fully. The `mc_*` tools appear under the tools (🔌) menu once it
reconnects. If your Claude Desktop version supports **custom connectors** natively, you can
instead add the `http://YOUR-SERVER-HOST:8765/mcp` URL directly in **Settings → Connectors** with
the `Authorization: Bearer <token>` header — that skips `mcp-remote` entirely.

## Sample prompts

With at least one player in the world (the agent acts relative to players and the world origin),
try prompts like these in Claude Desktop:

**Building**

> "Build a 9×9×5 hollow stone-brick house at around x=100, z=100 on the surface, with a door, a
> couple of glass windows, and torches inside. Find a flat spot first."

> "Clear a 20×20 area to bedrock-flat grass, then lay out a small village square — a fountain in
> the middle, paths to four corners, and a lamp post at each corner."

> "Save the structure I just built as `starter-house` so I can paste copies of it elsewhere."

**Interacting with the world**

> "What's the time and weather right now? Set it to clear and to midday."

> "List the players online and tell me what each is holding and standing on."

> "Spawn a ring of twelve armor stands around the nearest player, then give that player a
> netherite pickaxe."

**Reacting to events**

> "Subscribe to block-break events, then tell me what gets broken over the next minute."

> "Strike lightning wherever a player places a redstone block — keep watching until I say stop."

Start small and concrete. The agent works through the tool surface below; vague prompts ("make it
cooler") give it nothing to aim at.

---

# Reference

## Install

```sh
npm install -g minecraft-bedrock-mcp-server
```

Run it directly without installing:

```sh
npx minecraft-bedrock-mcp-server
```

Or with Docker. Each `v*` tag publishes a multi-arch image (`linux/amd64`,
`linux/arm64`) to the GitHub Container Registry — pull and run it directly:

```sh
docker run --env-file .env -p 8765:8765 ghcr.io/chapmanjw/minecraft-bedrock-mcp-server:latest
```

Pin to a specific version (e.g. `:0.3.0`) for reproducible deployments. To build the
image from source instead:

```sh
docker build -t minecraft-bedrock-mcp-server .
docker run --env-file .env -p 8765:8765 minecraft-bedrock-mcp-server
```

## Configuration reference

All configuration is through environment variables, validated at startup — the server exits with
a clear message if a required variable is missing. Copy [.env.example](.env.example) and adjust.

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

[mkcert](https://github.com/FiloSottile/mkcert) issues a certificate trusted by your LAN machines:

```sh
mkcert -install
mkcert bedrock-host.lan 192.168.1.50
```

Point the server at the generated files:

```sh
BRIDGE_TLS_CERT=./bedrock-host.lan+1.pem
BRIDGE_TLS_KEY=./bedrock-host.lan+1-key.pem
```

When both are set, the server listens HTTPS only. When neither is set, it listens HTTP and logs a
prominent warning at startup.

### TLS at a reverse proxy

Alternatively, terminate TLS upstream — Caddy with its internal CA, or Traefik — and run this
server on plain HTTP bound to `localhost`. Set `BRIDGE_TRUST_PROXY=true` so client IP addresses
are logged correctly.

## Tool surface

78 tools across 13 domains, consistently named `mc_<domain>_<action>`:

| Domain          | Examples                                                          |
| --------------- | ----------------------------------------------------------------- |
| World           | `mc_world_get_info`, `mc_world_set_time`, `mc_world_set_weather`  |
| Blocks          | `mc_block_get`, `mc_block_fill`, `mc_block_clone`                 |
| Structures      | `mc_structure_create_from_blocks`, `mc_structure_place`           |
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

Note that this contract is the _server's_ contract. The **underlying Bedrock Script API is not
stable** (see the warning at the top): a Bedrock update can still break behavior even when this
server's contract is unchanged.

## Security

- Two separate bearer tokens isolate MCP clients from the behavior pack; tokens are compared in
  constant time.
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
