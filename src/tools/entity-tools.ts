import { z } from "zod";
import { DimensionSchema, EntityIdSchema, Vector3Schema } from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

const READ_ONLY = { readOnlyHint: true } as const;

/** A subset of Script API `EntityQueryOptions`. */
const EntityQuerySchema = z.object({
  type: z.string().optional().describe("Entity type id, e.g. minecraft:zombie."),
  name: z.string().optional(),
  tags: z.array(z.string()).optional(),
  exclude_tags: z.array(z.string()).optional(),
  families: z.array(z.string()).optional(),
  dimension: DimensionSchema.optional(),
  location: Vector3Schema.optional(),
  min_distance: z.number().nonnegative().optional(),
  max_distance: z.number().nonnegative().optional(),
  closest: z.number().int().positive().optional(),
  farthest: z.number().int().positive().optional(),
  limit: z.number().int().positive().optional(),
});

/** Entity queries and entity mutations. */
export const entityTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_entity_get",
    title: "Query entities",
    description:
      "Returns one entity by id, or every entity matching a query. Provide " +
      "entity_id or query.",
    inputShape: {
      entity_id: EntityIdSchema.optional(),
      query: EntityQuerySchema.optional(),
    },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_entity_spawn",
    title: "Spawn an entity",
    description: "Spawns an entity of a type at a location.",
    inputShape: {
      dimension: DimensionSchema,
      type_id: z.string().min(1),
      location: Vector3Schema,
      spawn_event: z.string().optional().describe("Optional spawn event to trigger."),
    },
  }),
  defineQueuedTool({
    name: "mc_entity_remove",
    title: "Remove an entity",
    description: "Removes an entity, either by killing it or despawning it silently.",
    inputShape: {
      entity_id: EntityIdSchema,
      method: z.enum(["kill", "despawn"]).optional(),
    },
    annotations: { destructiveHint: true },
  }),
  defineQueuedTool({
    name: "mc_entity_teleport",
    title: "Teleport an entity",
    description: "Teleports an entity, optionally to another dimension or facing a target.",
    inputShape: {
      entity_id: EntityIdSchema,
      location: Vector3Schema,
      options: z
        .object({
          dimension: DimensionSchema.optional(),
          rotation: z.object({ x: z.number(), y: z.number() }).optional(),
          facing_location: Vector3Schema.optional(),
        })
        .optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_entity_apply_damage",
    title: "Damage an entity",
    description: "Applies damage to an entity.",
    inputShape: {
      entity_id: EntityIdSchema,
      amount: z.number().positive(),
      cause: z.string().optional().describe("Damage cause, e.g. entityAttack or fire."),
    },
    annotations: { destructiveHint: true },
  }),
  defineQueuedTool({
    name: "mc_entity_apply_effect",
    title: "Apply an effect to an entity",
    description: "Applies a status effect to an entity.",
    inputShape: {
      entity_id: EntityIdSchema,
      effect: z.string().min(1),
      duration_ticks: z.number().int().positive(),
      amplifier: z.number().int().min(0).optional(),
      show_particles: z.boolean().optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_entity_remove_effect",
    title: "Remove an effect from an entity",
    description: "Removes a status effect from an entity.",
    inputShape: { entity_id: EntityIdSchema, effect: z.string().min(1) },
  }),
  defineQueuedTool({
    name: "mc_entity_add_tag",
    title: "Add a tag to an entity",
    description: "Adds a tag to an entity.",
    inputShape: { entity_id: EntityIdSchema, tag: z.string().min(1) },
  }),
  defineQueuedTool({
    name: "mc_entity_remove_tag",
    title: "Remove a tag from an entity",
    description: "Removes a tag from an entity.",
    inputShape: { entity_id: EntityIdSchema, tag: z.string().min(1) },
  }),
  defineQueuedTool({
    name: "mc_entity_get_tags",
    title: "Get an entity's tags",
    description: "Returns every tag on an entity.",
    inputShape: { entity_id: EntityIdSchema },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_entity_get_components",
    title: "Get an entity's components",
    description: "Returns the components of an entity, such as health and inventory.",
    inputShape: { entity_id: EntityIdSchema },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_entity_run_command_as",
    title: "Run a command as an entity",
    description: "Runs a slash command with an entity as the executor.",
    inputShape: { entity_id: EntityIdSchema, command: z.string().min(1) },
    annotations: { openWorldHint: true },
  }),
];
