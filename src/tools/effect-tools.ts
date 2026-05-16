import { z } from "zod";
import { DimensionSchema, EntityIdSchema, Vector3Schema } from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

/** Environmental effects. */
export const effectTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_explosion_create",
    title: "Create an explosion",
    description: "Triggers an explosion at a location.",
    inputShape: {
      dimension: DimensionSchema,
      location: Vector3Schema,
      radius: z.number().positive(),
      options: z
        .object({
          causes_fire: z.boolean().optional(),
          breaks_blocks: z.boolean().optional(),
          allow_underwater: z.boolean().optional(),
          source_entity_id: EntityIdSchema.optional(),
        })
        .optional(),
    },
    annotations: { destructiveHint: true },
  }),
  defineQueuedTool({
    name: "mc_lightning_strike",
    title: "Strike lightning",
    description: "Strikes lightning at a location.",
    inputShape: { dimension: DimensionSchema, location: Vector3Schema },
  }),
];
