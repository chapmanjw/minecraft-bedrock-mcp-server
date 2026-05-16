/**
 * The bridge protocol — the wire contract between the MCP server and the BDS
 * behavior pack.
 *
 * This module is a self-contained leaf: it depends only on `zod` and nothing
 * else in `src/`, so it can be extracted into a package shared with the
 * behavior-pack repository without untangling dependencies.
 */
export * from "./protocol-version.js";
export * from "./command.js";
export * from "./result.js";
export * from "./event.js";
export * from "./handshake.js";
