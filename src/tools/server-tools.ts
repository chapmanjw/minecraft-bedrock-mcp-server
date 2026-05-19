import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

/** Server administration. */
export const serverTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_server_reload_addons",
    title: "Reload addons",
    description: "Reloads behavior and resource pack scripts and functions — the /reload command.",
    inputShape: {},
  }),
  defineQueuedTool({
    name: "mc_server_reload_world",
    title: "Reload the world",
    description:
      "Runs /reload all — reloads behavior and resource packs, re-indexing uploaded " +
      ".mcstructure files, and rejoins online players. Requires at least one online " +
      "player; with none, restart the dedicated server instead.",
    inputShape: {},
  }),
  defineQueuedTool({
    name: "mc_server_save_world",
    title: "Save the world",
    description: "Forces the world to save to disk.",
    inputShape: {},
    annotations: { idempotentHint: true },
  }),
  defineQueuedTool({
    name: "mc_server_get_status",
    title: "Get server status",
    description: "Returns uptime, online player count, and an approximate ticks-per-second.",
    inputShape: {},
    annotations: { readOnlyHint: true },
  }),
];
