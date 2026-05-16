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
export const MessageSchema = z.union([
  z.string(),
  z.object({ rawtext: z.array(z.unknown()) }),
]);
export type Message = z.infer<typeof MessageSchema>;
