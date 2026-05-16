# Security Policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/chapmanjw/minecraft-bedrock-mcp-server/security/advisories/new)
rather than a public issue. You will receive an acknowledgement within a few days.

## Security model

- **Two bearer tokens.** MCP clients (`BRIDGE_CLIENT_TOKEN`) and the behavior pack
  (`BRIDGE_AGENT_TOKEN`) authenticate separately, so the pack's token can be scoped and
  rotated independently of client tokens. Tokens are compared in constant time.
- **Authentication everywhere.** Every route except the `/healthz` liveness probe requires a
  valid bearer token.
- **Transport.** TLS is supported via `BRIDGE_TLS_CERT` and `BRIDGE_TLS_KEY`. With no TLS
  configured the server logs a prominent startup warning; do not run it over plain HTTP
  outside a trusted network.
- **Rate limiting.** Per-token request limits apply to the MCP surface, and per-command
  throttling shields the BDS script watchdog from bursts.
- **Resource limits.** Request bodies are size-limited and the in-memory command queue is
  bounded.

## Scope

This server executes world-mutating commands on a Minecraft server. Treat the client token
as a credential that grants full control of the world, and deploy the server only on
networks you trust.
