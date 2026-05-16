import { z } from "zod";
import { DimensionSchema, MessageSchema, Vector3Schema } from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

const READ_ONLY = { readOnlyHint: true } as const;

const SoundOptionsSchema = z.object({
  volume: z.number().nonnegative().optional(),
  pitch: z.number().positive().optional(),
});

/** World queries and world-level mutations. */
export const worldTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_world_get_info",
    title: "Get world info",
    description:
      "Returns the world name, Minecraft version, online player count, current " +
      "tick, and day count.",
    inputShape: {},
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_world_get_time",
    title: "Get world time",
    description: "Returns the absolute time and the time of day.",
    inputShape: {},
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_world_get_weather",
    title: "Get weather",
    description: "Returns the current weather in a dimension.",
    inputShape: { dimension: DimensionSchema },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_world_get_dimensions",
    title: "List dimensions",
    description: "Returns the identifiers of every dimension.",
    inputShape: {},
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_world_get_dimension_info",
    title: "Get dimension info",
    description: "Returns details for a dimension, such as its height range.",
    inputShape: { dimension: DimensionSchema },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_world_set_time",
    title: "Set world time",
    description: "Sets the time of day.",
    inputShape: {
      value: z.number().int().min(0).describe("Time of day in ticks (0-24000)."),
    },
  }),
  defineQueuedTool({
    name: "mc_world_set_weather",
    title: "Set weather",
    description: "Sets the weather in a dimension.",
    inputShape: {
      dimension: DimensionSchema,
      type: z.enum(["Clear", "Rain", "Thunder"]),
      duration: z.number().int().positive().optional().describe("Duration in ticks."),
    },
  }),
  defineQueuedTool({
    name: "mc_world_send_message",
    title: "Send a chat message",
    description: "Sends a chat message to all players or to a specific player.",
    inputShape: {
      target: z.string().min(1).describe("A player name, or 'all' for everyone."),
      message: MessageSchema,
    },
  }),
  defineQueuedTool({
    name: "mc_world_play_sound",
    title: "Play a sound",
    description: "Plays a sound at a location in a dimension.",
    inputShape: {
      dimension: DimensionSchema,
      sound: z.string().min(1),
      location: Vector3Schema,
      options: SoundOptionsSchema.optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_world_spawn_particle",
    title: "Spawn a particle",
    description: "Spawns a particle effect at a location in a dimension.",
    inputShape: {
      dimension: DimensionSchema,
      name: z.string().min(1).describe("Particle type id, e.g. minecraft:basic_flame_particle."),
      location: Vector3Schema,
      molang_variables: z.record(z.number()).optional(),
    },
  }),
];
