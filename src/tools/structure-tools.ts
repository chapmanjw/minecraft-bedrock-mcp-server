import { z } from "zod";
import {
  BlockStatesSchema,
  BlockTypeSchema,
  DimensionSchema,
  Vector3Schema,
} from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

const StructureIdSchema = z
  .string()
  .min(1)
  .describe("Structure identifier, e.g. mystructures:house.");

/** Script API `StructureManager` operations. */
export const structureTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_structure_list",
    title: "List structures",
    description: "Returns the ids of all in-memory and world-saved structures.",
    inputShape: {},
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_structure_get",
    title: "Get structure metadata",
    description: "Returns metadata for a structure, such as its size.",
    inputShape: { id: StructureIdSchema },
    annotations: { readOnlyHint: true },
  }),
  defineQueuedTool({
    name: "mc_structure_create_empty",
    title: "Create an empty structure",
    description: "Creates a new, empty structure of a given size.",
    inputShape: {
      id: StructureIdSchema,
      size: Vector3Schema,
      save_mode: z.enum(["memory", "world"]).optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_structure_create_from_world",
    title: "Capture a structure from the world",
    description: "Captures the blocks in a bounding box into a new structure.",
    inputShape: {
      id: StructureIdSchema,
      dimension: DimensionSchema,
      from: Vector3Schema,
      to: Vector3Schema,
      options: z
        .object({
          include_entities: z.boolean().optional(),
          include_blocks: z.boolean().optional(),
          save_mode: z.enum(["memory", "world"]).optional(),
        })
        .optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_structure_create_from_blocks",
    title: "Create a structure from a block grid",
    description:
      "Builds a saved structure from a run-length-encoded block grid — for materializing " +
      "structures that are computed rather than built in the world. `palette` lists the " +
      "distinct block states; `blocks` is an array of [count, palette_index] runs in ZYX " +
      "order (index z + size.z * (y + size.y * x)) whose counts sum to size.x*size.y*size.z. " +
      "A palette index of -1 leaves a structure void. The structure is built in-world and " +
      "is immediately placeable with mc_structure_place.",
    inputShape: {
      id: StructureIdSchema,
      size: Vector3Schema,
      palette: z
        .array(
          z.object({
            name: BlockTypeSchema,
            states: BlockStatesSchema.optional(),
          }),
        )
        .min(1)
        .describe("Distinct block states the block grid indexes into, from 0."),
      blocks: z
        .array(z.tuple([z.number().int().positive(), z.number().int().gte(-1)]))
        .describe(
          "Run-length-encoded palette indices in ZYX order: [count, index] pairs whose " +
            "counts sum to the volume. An index of -1 is a structure void.",
        ),
      save_mode: z.enum(["memory", "world"]).optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_structure_place",
    title: "Place a structure",
    description: "Places a saved structure into the world.",
    inputShape: {
      id: StructureIdSchema,
      dimension: DimensionSchema,
      location: Vector3Schema,
      options: z
        .object({
          rotation: z.enum(["None", "Rotate90", "Rotate180", "Rotate270"]).optional(),
          mirror: z.enum(["None", "X", "Z", "XZ"]).optional(),
          integrity: z.number().min(0).max(1).optional(),
          include_entities: z.boolean().optional(),
          animation_mode: z.enum(["None", "Layers", "Blocks"]).optional(),
          animation_seconds: z.number().nonnegative().optional(),
        })
        .optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_structure_delete",
    title: "Delete a structure",
    description: "Deletes a structure from memory and the world.",
    inputShape: { id: StructureIdSchema },
    annotations: { destructiveHint: true },
  }),
  defineQueuedTool({
    name: "mc_structure_set_block",
    title: "Edit a structure block",
    description: "Sets a block within an in-memory structure.",
    inputShape: {
      id: StructureIdSchema,
      location: Vector3Schema,
      block_type: BlockTypeSchema,
      states: BlockStatesSchema.optional(),
    },
  }),
];
