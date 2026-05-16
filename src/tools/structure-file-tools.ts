import { z } from "zod";
import { defineLocalTool, type ToolDefinition } from "./tool-definition.js";
import { toolError, toolSuccess } from "./tool-result.js";

/** Filesystem operations on `.mcstructure` files — these run on the MCP host. */
export const structureFileTools: readonly ToolDefinition[] = [
  defineLocalTool({
    name: "mc_structure_file_list",
    title: "List structure files",
    description: "Lists the .mcstructure files in the behavior pack's structures folder.",
    inputShape: {},
    annotations: { readOnlyHint: true },
    handler: async (_input, context) => {
      const files = await context.structureFiles.list();
      return toolSuccess({ files });
    },
  }),
  defineLocalTool({
    name: "mc_structure_file_read",
    title: "Read a structure file",
    description: "Reads a .mcstructure file and returns its base64-encoded contents.",
    inputShape: { name: z.string().min(1) },
    annotations: { readOnlyHint: true },
    handler: async (input, context) => {
      const data = await context.structureFiles.read(input.name);
      return toolSuccess({ name: input.name, base64_data: data.toString("base64") });
    },
  }),
  defineLocalTool({
    name: "mc_structure_file_write",
    title: "Write a structure file",
    description:
      "Writes a .mcstructure file from base64-encoded contents — for placing " +
      "externally generated structures into the behavior pack.",
    inputShape: {
      name: z.string().min(1),
      base64_data: z.string().describe("The .mcstructure file contents, base64-encoded."),
    },
    handler: async (input, context) => {
      const data = Buffer.from(input.base64_data, "base64");
      const info = await context.structureFiles.write(input.name, data);
      return toolSuccess(info);
    },
  }),
  defineLocalTool({
    name: "mc_structure_file_delete",
    title: "Delete a structure file",
    description: "Deletes a .mcstructure file from the behavior pack's structures folder.",
    inputShape: { name: z.string().min(1) },
    annotations: { destructiveHint: true },
    handler: async (input, context) => {
      const deleted = await context.structureFiles.remove(input.name);
      return deleted
        ? toolSuccess({ name: input.name, deleted: true })
        : toolError("NOT_FOUND", `no structure file '${input.name}'`);
    },
  }),
];
