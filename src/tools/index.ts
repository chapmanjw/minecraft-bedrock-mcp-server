import { blockTools } from "./block-tools.js";
import { commandTools } from "./command-tools.js";
import { effectTools } from "./effect-tools.js";
import { entityTools } from "./entity-tools.js";
import { eventTools } from "./event-tools.js";
import { inventoryTools } from "./inventory-tools.js";
import { playerTools } from "./player-tools.js";
import { propertyTools } from "./property-tools.js";
import { scoreboardTools } from "./scoreboard-tools.js";
import { serverTools } from "./server-tools.js";
import { structureFileTools } from "./structure-file-tools.js";
import { structureTools } from "./structure-tools.js";
import { structureUploadTools } from "./structure-upload-tools.js";
import type { ToolDefinition } from "./tool-definition.js";
import { worldTools } from "./world-tools.js";

/** Every MCP tool the server exposes, assembled from the per-domain modules. */
export const allTools: readonly ToolDefinition[] = [
  ...worldTools,
  ...blockTools,
  ...structureTools,
  ...structureFileTools,
  ...structureUploadTools,
  ...entityTools,
  ...playerTools,
  ...inventoryTools,
  ...scoreboardTools,
  ...propertyTools,
  ...effectTools,
  ...eventTools,
  ...commandTools,
  ...serverTools,
];
