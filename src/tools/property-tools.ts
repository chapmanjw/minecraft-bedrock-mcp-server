import { z } from "zod";
import { EntityIdSchema, Vector3Schema } from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

/** The scope a dynamic property is stored on — the world, or an entity. */
const PropertyScopeSchema = z.union([z.literal("world"), z.object({ entity_id: EntityIdSchema })]);

/** A dynamic property value. */
const PropertyValueSchema = z.union([z.string(), z.number(), z.boolean(), Vector3Schema]);

/** Persistent dynamic-property storage. */
export const propertyTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_property_get",
    title: "Get a dynamic property",
    description: "Returns a dynamic property stored on the world or an entity.",
    inputShape: { scope: PropertyScopeSchema, name: z.string().min(1) },
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_property_set",
    title: "Set a dynamic property",
    description: "Stores a dynamic property on the world or an entity.",
    inputShape: {
      scope: PropertyScopeSchema,
      name: z.string().min(1),
      value: PropertyValueSchema,
    },
  }),
  defineQueuedTool({
    name: "mc_property_list",
    title: "List dynamic properties",
    description: "Returns the names of every dynamic property in a scope.",
    inputShape: { scope: PropertyScopeSchema },
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_property_clear",
    title: "Clear dynamic properties",
    description: "Removes one dynamic property, or every property in a scope.",
    inputShape: {
      scope: PropertyScopeSchema,
      name: z.string().min(1).optional().describe("Omit to clear every property in the scope."),
    },
    annotations: { destructiveHint: true },
  }),
];
