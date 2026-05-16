import { z } from "zod";
import {
  BlockFilterSchema,
  BlockStatesSchema,
  BlockTypeSchema,
  DimensionSchema,
  Vector3Schema,
} from "./common-schemas.js";
import { defineQueuedTool, type ToolDefinition } from "./tool-definition.js";

const READ_ONLY = { readOnlyHint: true } as const;

/** Block reads and block writes. */
export const blockTools: readonly ToolDefinition[] = [
  defineQueuedTool({
    name: "mc_block_get",
    title: "Get a block",
    description: "Returns the type, permutation states, and components of the block at a location.",
    inputShape: { dimension: DimensionSchema, location: Vector3Schema },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_block_get_volume",
    title: "Get a volume of blocks",
    description:
      "Iterates the blocks in a bounding box, optionally filtered by type. Results " +
      "are paginated — pass the returned cursor to fetch the next page.",
    inputShape: {
      dimension: DimensionSchema,
      from: Vector3Schema,
      to: Vector3Schema,
      filter: BlockFilterSchema.optional(),
      cursor: z.string().optional().describe("Cursor from a previous page; omit for the first."),
    },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_block_get_top",
    title: "Get the topmost block",
    description: "Returns the highest non-air block in a column.",
    inputShape: { dimension: DimensionSchema, x: z.number().int(), z: z.number().int() },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_block_contains",
    title: "Check for blocks in a volume",
    description: "Returns whether any block in a bounding box matches a filter.",
    inputShape: {
      dimension: DimensionSchema,
      from: Vector3Schema,
      to: Vector3Schema,
      filter: BlockFilterSchema,
    },
    annotations: READ_ONLY,
  }),
  defineQueuedTool({
    name: "mc_block_set",
    title: "Set a block",
    description: "Places a single block at a location.",
    inputShape: {
      dimension: DimensionSchema,
      location: Vector3Schema,
      block_type: BlockTypeSchema,
      states: BlockStatesSchema.optional(),
    },
    annotations: { idempotentHint: true },
  }),
  defineQueuedTool({
    name: "mc_block_fill",
    title: "Fill a volume with a block",
    description: "Fills a bounding box with a block type, optionally hollow or filtered.",
    inputShape: {
      dimension: DimensionSchema,
      from: Vector3Schema,
      to: Vector3Schema,
      block_type: BlockTypeSchema,
      states: BlockStatesSchema.optional(),
      options: z
        .object({
          mode: z.enum(["replace", "keep", "hollow", "outline"]).optional(),
          filter: BlockFilterSchema.optional(),
        })
        .optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_block_clone",
    title: "Clone a volume of blocks",
    description: "Copies the blocks in a bounding box to another location.",
    inputShape: {
      source_dimension: DimensionSchema,
      source_from: Vector3Schema,
      source_to: Vector3Schema,
      destination_dimension: DimensionSchema,
      destination_location: Vector3Schema,
      options: z
        .object({
          mode: z.enum(["replace", "masked"]).optional(),
          include_entities: z.boolean().optional(),
        })
        .optional(),
    },
  }),
  defineQueuedTool({
    name: "mc_block_replace",
    title: "Replace blocks in a volume",
    description: "Replaces blocks matching a filter within a bounding box.",
    inputShape: {
      dimension: DimensionSchema,
      from: Vector3Schema,
      to: Vector3Schema,
      source_filter: BlockFilterSchema,
      replacement: z.object({
        block_type: BlockTypeSchema,
        states: BlockStatesSchema.optional(),
      }),
    },
  }),
];
