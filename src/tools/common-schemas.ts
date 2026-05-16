import { z } from "zod";

/** A world coordinate. */
export const Vector3Schema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Vector3 = z.infer<typeof Vector3Schema>;

/** A dimension identifier. */
export const DimensionSchema = z.enum(["overworld", "nether", "the_end"]);
export type Dimension = z.infer<typeof DimensionSchema>;

/** A chat message: plain text, or a structured rawtext object. */
export const MessageSchema = z.union([z.string(), z.object({ rawtext: z.array(z.unknown()) })]);
export type Message = z.infer<typeof MessageSchema>;

/** A block type identifier, e.g. `minecraft:stone`. */
export const BlockTypeSchema = z.string().min(1);

/** Block permutation states, keyed by state name. */
export const BlockStatesSchema = z.record(z.union([z.string(), z.number(), z.boolean()]));

/** A filter selecting block types by inclusion or exclusion. */
export const BlockFilterSchema = z.object({
  include: z.array(BlockTypeSchema).optional().describe("Only blocks of these types match."),
  exclude: z.array(BlockTypeSchema).optional().describe("Blocks of these types never match."),
});

/** An item type identifier, e.g. `minecraft:diamond_sword`. */
export const ItemTypeSchema = z.string().min(1);

/** Optional properties applied to an item stack. */
export const ItemPropertiesSchema = z.object({
  name_tag: z.string().optional(),
  lore: z.array(z.string()).optional(),
  keep_on_death: z.boolean().optional(),
  lock_mode: z.enum(["none", "lock_in_slot", "lock_in_inventory"]).optional(),
});

/** The runtime id of an entity. */
export const EntityIdSchema = z.string().min(1);
