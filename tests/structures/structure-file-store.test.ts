import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { BridgeError } from "../../src/errors/bridge-error.js";
import { createStructureFileStore } from "../../src/structures/structure-file-store.js";

describe("structure file store", () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), "bridge-struct-"));
  });
  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it("writes and reads a structure file", async () => {
    const store = createStructureFileStore(root);
    const data = Buffer.from("structure-bytes");
    const info = await store.write("house", data);
    expect(info).toEqual({ name: "house.mcstructure", bytes: data.byteLength });
    expect((await store.read("house")).toString()).toBe("structure-bytes");
  });

  it("appends the .mcstructure extension when omitted", async () => {
    const store = createStructureFileStore(root);
    await store.write("tower", Buffer.from("x"));
    const [file] = await store.list();
    expect(file?.name).toBe("tower.mcstructure");
  });

  it("lists written structure files", async () => {
    const store = createStructureFileStore(root);
    await store.write("a.mcstructure", Buffer.from("a"));
    await store.write("b.mcstructure", Buffer.from("bb"));
    const names = (await store.list()).map((file) => file.name).sort();
    expect(names).toEqual(["a.mcstructure", "b.mcstructure"]);
  });

  it("returns an empty list when the structures folder does not exist", async () => {
    const store = createStructureFileStore(join(root, "missing"));
    expect(await store.list()).toEqual([]);
  });

  it("removes a structure file", async () => {
    const store = createStructureFileStore(root);
    await store.write("temp", Buffer.from("x"));
    expect(await store.remove("temp")).toBe(true);
    expect(await store.remove("temp")).toBe(false);
  });

  it("reads a missing file as NOT_FOUND", async () => {
    const store = createStructureFileStore(root);
    await expect(store.read("ghost")).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects path traversal in a file name", async () => {
    const store = createStructureFileStore(root);
    await expect(store.read("../escape")).rejects.toMatchObject({
      code: "STRUCTURE_FILE_ERROR",
    });
    await expect(store.write("sub/dir", Buffer.from("x"))).rejects.toBeInstanceOf(BridgeError);
  });
});
