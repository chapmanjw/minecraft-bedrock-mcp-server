import { z } from "zod";
import {
  DimensionSchema,
  EntityIdSchema,
  ItemPropertiesSchema,
  ItemTypeSchema,
  Vector3Schema,
} from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

/** A reference to an item container — an entity, or a block at a location. */
const ContainerRefSchema = z.object({
  entity_id: EntityIdSchema.optional(),
  block: z.object({ dimension: DimensionSchema, location: Vector3Schema }).optional(),
});

/** Item spawning and container inventory access. */
export const inventoryTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_item_spawn",
    title: "Spawn an item",
    description: "Spawns a dropped item entity at a location.",
    inputShape: {
      dimension: DimensionSchema,
      item_type: ItemTypeSchema,
      location: Vector3Schema,
      count: z.number().int().positive().optional(),
      properties: ItemPropertiesSchema.optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_inventory_get",
    title: "Get a container's inventory",
    description: "Returns the items in an entity's or block's inventory.",
    inputShape: { container: ContainerRefSchema },
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_inventory_set_slot",
    title: "Set an inventory slot",
    description: "Places an item stack into a specific inventory slot.",
    inputShape: {
      container: ContainerRefSchema,
      slot: z.number().int().nonnegative(),
      item_type: ItemTypeSchema,
      count: z.number().int().positive().optional(),
      properties: ItemPropertiesSchema.optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_inventory_clear_slot",
    title: "Clear an inventory slot",
    description: "Empties a specific inventory slot.",
    inputShape: {
      container: ContainerRefSchema,
      slot: z.number().int().nonnegative(),
    },
  }),
];
