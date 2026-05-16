import { z } from "zod";
import { DimensionSchema } from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

/** The raw slash-command escape hatch. */
export const commandTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_run_command",
    title: "Run a slash command",
    description:
      "Executes a Minecraft slash command and returns its output. The escape " +
      "hatch for anything not covered by a higher-level tool.",
    inputShape: {
      command: z.string().min(1).describe("The slash command, without a leading '/'."),
      dimension: DimensionSchema.optional().describe("Dimension to run the command in."),
      executor: z
        .string()
        .min(1)
        .optional()
        .describe("Entity id to run the command as; defaults to the server."),
    },
    annotations: { openWorldHint: true },
  }),
];
