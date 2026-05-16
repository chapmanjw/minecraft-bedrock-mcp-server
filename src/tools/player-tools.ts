import { z } from "zod";
import {
  ItemPropertiesSchema,
  ItemTypeSchema,
  MessageSchema,
  Vector3Schema,
} from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

const PlayerSchema = z.string().min(1).describe("Player name.");

/** Player queries and player-specific mutations. */
export const playerTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_player_list",
    title: "List players",
    description: "Returns the name, id, location, dimension, and game mode of every online player.",
    inputShape: {},
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_player_send_message",
    title: "Send a message to a player",
    description: "Sends a chat message to a single player.",
    inputShape: { player: PlayerSchema, message: MessageSchema },
  }),
  defineQueuedTool({
    name: "mc_player_send_title",
    title: "Show a title to a player",
    description: "Shows a title, and optional subtitle, on a player's screen.",
    inputShape: {
      player: PlayerSchema,
      title: z.string(),
      subtitle: z.string().optional(),
      options: z
        .object({
          fade_in_ticks: z.number().int().nonnegative().optional(),
          stay_ticks: z.number().int().nonnegative().optional(),
          fade_out_ticks: z.number().int().nonnegative().optional(),
        })
        .optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_player_send_actionbar",
    title: "Show an action bar message",
    description: "Shows a message on a player's action bar.",
    inputShape: { player: PlayerSchema, text: z.string() },
  }),
  defineQueuedTool({
    name: "mc_player_set_gamemode",
    title: "Set a player's game mode",
    description: "Sets a player's game mode.",
    inputShape: {
      player: PlayerSchema,
      mode: z.enum(["survival", "creative", "adventure", "spectator"]),
    },
  }),
  defineQueuedTool({
    name: "mc_player_give_item",
    title: "Give an item to a player",
    description: "Adds an item stack to a player's inventory.",
    inputShape: {
      player: PlayerSchema,
      item_type: ItemTypeSchema,
      count: z.number().int().positive().optional(),
      properties: ItemPropertiesSchema.optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_player_clear_inventory",
    title: "Clear a player's inventory",
    description: "Removes every item from a player's inventory.",
    inputShape: { player: PlayerSchema },
    annotations: { destructiveHint: true },
  }),
  defineQueuedTool({
    name: "mc_player_get_inventory",
    title: "Get a player's inventory",
    description: "Returns the contents of a player's inventory.",
    inputShape: { player: PlayerSchema },
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_player_set_camera",
    title: "Set a player's camera",
    description: "Sets a player's camera to a preset, or to a fixed location and orientation.",
    inputShape: {
      player: PlayerSchema,
      options: z.object({
        preset: z.string().optional().describe("Camera preset id, e.g. minecraft:free."),
        location: Vector3Schema.optional(),
        rotation: z.object({ x: z.number(), y: z.number() }).optional(),
        facing_location: Vector3Schema.optional(),
        ease_seconds: z.number().nonnegative().optional(),
        ease_type: z.string().optional(),
      }),
    },
  }),
  defineQueuedTool({
    name: "mc_player_play_sound",
    title: "Play a sound for a player",
    description: "Plays a sound for a single player.",
    inputShape: {
      player: PlayerSchema,
      sound: z.string().min(1),
      options: z
        .object({
          location: Vector3Schema.optional(),
          volume: z.number().nonnegative().optional(),
          pitch: z.number().positive().optional(),
        })
        .optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_player_kick",
    title: "Kick a player",
    description: "Disconnects a player from the server.",
    inputShape: { player: PlayerSchema, reason: z.string().optional() },
    annotations: { destructiveHint: true },
  }),
];
