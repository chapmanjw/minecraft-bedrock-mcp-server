import { commandTools } from "./command-tools.js";
import { eventTools } from "./event-tools.js";
import { structureFileTools } from "./structure-file-tools.js";
import type { ToolDefinition } from "./tool-definition.js";
import { worldTools } from "./world-tools.js";

/** Every MCP tool the server exposes, assembled from the per-domain modules. */
export const allTools: readonly ToolDefinition[] = [
  ...commandTools,
  ...worldTools,
  ...structureFileTools,
  ...eventTools,
];
