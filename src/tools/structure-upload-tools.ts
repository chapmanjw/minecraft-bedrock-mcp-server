import { readFile } from "node:fs/promises";
import { z } from "zod";
import { encodeMcStructure, type StructureDefinition } from "../structures/mcstructure.js";
import { BlockStatesSchema, BlockTypeSchema } from "./common-schemas.js";
import { defineLocalTool, type ToolDefinition } from "./tool-definition.js";
import { toolError, toolSuccess } from "./tool-result.js";

/** The largest structure volume accepted — Bedrock's 64 x 384 x 64 cap. */
const MAX_VOLUME = 64 * 384 * 64;

/** One distinct block state in a structure's palette. */
const PaletteEntrySchema = z.object({
  name: BlockTypeSchema.describe("Block type id, e.g. minecraft:oak_planks."),
  states: BlockStatesSchema.optional().describe('Block states, e.g. { pillar_axis: "y" }.'),
});

/**
 * A block-grid description of a structure.
 *
 * `blocks` is a flat array of palette indices in ZYX order — index
 * `z + size.z * (y + size.y * x)` — with `-1` meaning a structure void that
 * leaves the existing world block untouched on placement.
 */
const StructureDefinitionSchema = z
  .object({
    size: z
      .object({
        x: z.number().int().positive(),
        y: z.number().int().positive(),
        z: z.number().int().positive(),
      })
      .describe("Structure extents in blocks."),
    palette: z.array(PaletteEntrySchema).min(1).describe("Distinct block states, indexed from 0."),
    blocks: z
      .array(z.number().int())
      .describe("Flat ZYX palette indices, length size.x*size.y*size.z; -1 = void."),
    waterlog: z
      .array(z.number().int())
      .optional()
      .describe("Optional secondary layer of the same length, for waterlogged blocks."),
    block_version: z
      .number()
      .int()
      .positive()
      .optional()
      .describe("Block compatibility version; defaults to a current value."),
  })
  .superRefine((def, ctx) => {
    const volume = def.size.x * def.size.y * def.size.z;
    if (volume > MAX_VOLUME) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `structure volume ${volume} exceeds the limit of ${MAX_VOLUME} blocks`,
      });
      return;
    }
    const maxIndex = def.palette.length - 1;
    const checkLayer = (layer: number[], field: "blocks" | "waterlog"): void => {
      if (layer.length !== volume) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} must have ${volume} entries to match size, got ${layer.length}`,
        });
        return;
      }
      if (layer.some((index) => index < -1 || index > maxIndex)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `every ${field} entry must be -1 (void) or a palette index 0..${maxIndex}`,
        });
      }
    };
    checkLayer(def.blocks, "blocks");
    if (def.waterlog !== undefined) checkLayer(def.waterlog, "waterlog");
  });

type StructureDefinitionInput = z.infer<typeof StructureDefinitionSchema>;

/** Maps the validated, snake-cased tool input to the encoder's interface. */
function toDefinition(input: StructureDefinitionInput): StructureDefinition {
  return {
    size: input.size,
    palette: input.palette,
    blocks: input.blocks,
    waterlog: input.waterlog,
    blockVersion: input.block_version,
  };
}

/**
 * Tools for getting client-generated structures into the world.
 *
 * `mc_structure_upload` runs on the MCP host: it encodes a block-grid
 * definition into a `.mcstructure` file under the behavior pack's reserved
 * `mcp/` namespace folder, then reloads the world so the file is indexed and
 * can be placed as `mcp:<name>`.
 */
export const structureUploadTools: readonly ToolDefinition[] = [
  defineLocalTool({
    name: "mc_structure_upload",
    title: "Upload a structure",
    description:
      "Encodes a block-grid definition into a .mcstructure file in the behavior pack's " +
      "reserved mcp/ namespace, then reloads the world so it can be placed as mcp:<name>. " +
      "Supply the definition inline, or as definition_path — an absolute path to a JSON " +
      "file on the MCP server host. The world reload requires at least one online player.",
    inputShape: {
      name: z
        .string()
        .regex(/^[a-z0-9_-]+$/, "name must be lowercase letters, digits, underscores, and hyphens")
        .describe("Structure name; it is placed with the id mcp:<name>."),
      definition: StructureDefinitionSchema.optional().describe(
        "The structure, inline. Provide this or definition_path, not both.",
      ),
      definition_path: z
        .string()
        .min(1)
        .optional()
        .describe("Absolute host path to a JSON file holding the structure definition."),
      reload: z
        .boolean()
        .default(true)
        .describe("Reload the world after writing so the structure becomes placeable."),
    },
    handler: async (input, context) => {
      const hasInline = input.definition !== undefined;
      const hasPath = input.definition_path !== undefined;
      if (hasInline === hasPath) {
        return toolError("INVALID_INPUT", "provide exactly one of definition or definition_path");
      }

      let definition: StructureDefinition;
      if (input.definition !== undefined) {
        definition = toDefinition(input.definition);
      } else {
        const path = input.definition_path as string;
        let raw: string;
        try {
          raw = await readFile(path, "utf8");
        } catch {
          return toolError("STRUCTURE_FILE_ERROR", `unable to read definition file '${path}'`);
        }
        let json: unknown;
        try {
          json = JSON.parse(raw);
        } catch {
          return toolError("INVALID_INPUT", `definition file '${path}' is not valid JSON`);
        }
        const parsed = StructureDefinitionSchema.safeParse(json);
        if (!parsed.success) {
          return toolError(
            "INVALID_INPUT",
            `definition file '${path}' is not a valid structure definition`,
            parsed.error.issues.map((issue) => issue.message),
          );
        }
        definition = toDefinition(parsed.data);
      }

      // encodeMcStructure throws BridgeError("INVALID_INPUT") on a bad grid;
      // the registry wrapper turns that into a coded error envelope.
      const bytes = encodeMcStructure(definition);
      const info = await context.mcpStructures.write(input.name, bytes);
      const identifier = `mcp:${input.name}`;

      let reloadPerformed = false;
      let reloadError: string | undefined;
      if (input.reload) {
        try {
          const result = await context.queue.enqueueAndAwait({
            kind: "mc_server_reload_world",
            payload: {},
            correlationId: context.correlationId,
            timeoutMs: context.commandTimeoutMs,
          });
          if (result.status === "ok") {
            reloadPerformed = true;
          } else {
            reloadError = result.error.message;
          }
        } catch (error) {
          // The file is written regardless — report the reload failure
          // without failing the upload.
          reloadError = error instanceof Error ? error.message : "world reload failed";
        }
      }

      return toolSuccess({
        identifier,
        file: info.name,
        bytes: info.bytes,
        reload_performed: reloadPerformed,
        reload_required: !reloadPerformed,
        ...(reloadError === undefined ? {} : { reload_error: reloadError }),
      });
    },
  }),
];
