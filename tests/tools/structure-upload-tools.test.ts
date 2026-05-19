import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createStructureFileStore } from "../../src/structures/structure-file-store.js";
import { structureUploadTools } from "../../src/tools/structure-upload-tools.js";
import type { ToolContext } from "../../src/tools/tool-definition.js";

const uploadTool = structureUploadTools.find((tool) => tool.name === "mc_structure_upload");

/** A reload outcome the fake command queue should produce. */
type ReloadOutcome = "ok" | "error" | "throw";

/** Builds a ToolContext whose queue settles a reload with the given outcome. */
function contextFor(root: string, reload: ReloadOutcome): ToolContext {
  return {
    mcpStructures: createStructureFileStore(root),
    correlationId: "test",
    commandTimeoutMs: 1000,
    queue: {
      enqueueAndAwait: () => {
        if (reload === "throw") return Promise.reject(new Error("no behavior pack connected"));
        if (reload === "error") {
          return Promise.resolve({
            id: "cmd",
            status: "error",
            error: { code: "BEHAVIOR_PACK_ERROR", message: "no online player" },
          });
        }
        return Promise.resolve({ id: "cmd", status: "ok", result: { reload_scheduled: true } });
      },
    },
  } as unknown as ToolContext;
}

/** The text payload of a tool result. */
function text(result: CallToolResult): string {
  const block = result.content[0];
  return block?.type === "text" ? block.text : "";
}

describe("mc_structure_upload", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bridge-upload-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  const definition = {
    size: { x: 1, y: 1, z: 2 },
    palette: [{ name: "minecraft:stone" }],
    blocks: [0, -1],
  };

  it("encodes an inline definition, writes the file, and reports the reload", async () => {
    const result = (await uploadTool?.handler(
      { name: "hut", definition, reload: true },
      contextFor(root, "ok"),
    )) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(text(result)).toContain("mcp:hut");
    expect(text(result)).toContain("reload_performed: true");
    expect(readdirSync(root)).toEqual(["hut.mcstructure"]);
  });

  it("still succeeds when the world reload fails, flagging reload_required", async () => {
    const result = (await uploadTool?.handler(
      { name: "hut", definition, reload: true },
      contextFor(root, "error"),
    )) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(text(result)).toContain("reload_required: true");
    expect(text(result)).toContain("no online player");
    expect(readdirSync(root)).toEqual(["hut.mcstructure"]);
  });

  it("treats a disconnected bridge as a reload failure, not an upload failure", async () => {
    const result = (await uploadTool?.handler(
      { name: "hut", definition, reload: true },
      contextFor(root, "throw"),
    )) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(text(result)).toContain("no behavior pack connected");
    expect(readdirSync(root)).toEqual(["hut.mcstructure"]);
  });

  it("reads the definition from a host-side JSON file", async () => {
    const path = join(root, "def.json");
    writeFileSync(path, JSON.stringify(definition));

    const result = (await uploadTool?.handler(
      { name: "from_file", definition_path: path, reload: false },
      contextFor(root, "ok"),
    )) as CallToolResult;

    expect(result.isError).toBeFalsy();
    expect(text(result)).toContain("mcp:from_file");
    expect(readdirSync(root)).toContain("from_file.mcstructure");
  });

  it("rejects supplying both an inline definition and a path", async () => {
    const result = (await uploadTool?.handler(
      { name: "hut", definition, definition_path: "/tmp/x.json", reload: false },
      contextFor(root, "ok"),
    )) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("exactly one of definition or definition_path");
  });

  it("rejects supplying neither an inline definition nor a path", async () => {
    const result = (await uploadTool?.handler(
      { name: "hut", reload: false },
      contextFor(root, "ok"),
    )) as CallToolResult;

    expect(result.isError).toBe(true);
    expect(text(result)).toContain("exactly one of definition or definition_path");
  });
});
