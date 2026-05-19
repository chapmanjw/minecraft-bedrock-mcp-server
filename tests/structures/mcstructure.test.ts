import nbt from "prismarine-nbt";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_BLOCK_VERSION,
  encodeMcStructure,
  type StructureDefinition,
} from "../../src/structures/mcstructure.js";

/** Parses encoded `.mcstructure` bytes back into a plain object. */
async function decode(bytes: Buffer): Promise<Record<string, unknown>> {
  const { parsed } = await nbt.parse(bytes, "little");
  return nbt.simplify(parsed) as Record<string, unknown>;
}

/** A 2 x 1 x 3 structure: a 2-entry palette and two structure voids. */
function sampleDefinition(): StructureDefinition {
  return {
    size: { x: 2, y: 1, z: 3 },
    palette: [{ name: "minecraft:stone" }, { name: "minecraft:oak_planks" }],
    blocks: [0, 1, -1, 1, 0, -1],
  };
}

describe("encodeMcStructure", () => {
  it("encodes a structure that round-trips through the NBT reader", async () => {
    const decoded = await decode(encodeMcStructure(sampleDefinition()));

    expect(decoded["format_version"]).toBe(1);
    expect(decoded["size"]).toEqual([2, 1, 3]);
    expect(decoded["structure_world_origin"]).toEqual([0, 0, 0]);

    const structure = decoded["structure"] as Record<string, unknown>;
    const indices = structure["block_indices"] as number[][];
    expect(indices).toHaveLength(2);
    expect(indices[0]).toEqual([0, 1, -1, 1, 0, -1]);
    // The waterlog layer defaults to all-void when the caller omits it.
    expect(indices[1]).toEqual([-1, -1, -1, -1, -1, -1]);
  });

  it("writes the palette in order with the default block version", async () => {
    const decoded = await decode(encodeMcStructure(sampleDefinition()));
    const structure = decoded["structure"] as Record<string, unknown>;
    const palette = structure["palette"] as { default: { block_palette: unknown[] } };
    const entries = palette.default.block_palette as {
      name: string;
      version: number;
    }[];

    expect(entries.map((entry) => entry.name)).toEqual(["minecraft:stone", "minecraft:oak_planks"]);
    expect(entries[0]?.version).toBe(DEFAULT_BLOCK_VERSION);
  });

  it("encodes block states as the matching NBT tag types", async () => {
    const decoded = await decode(
      encodeMcStructure({
        size: { x: 1, y: 1, z: 1 },
        palette: [
          {
            name: "minecraft:oak_log",
            states: { pillar_axis: "y", deprecated: 0, upside_down_bit: true },
          },
        ],
        blocks: [0],
      }),
    );
    const structure = decoded["structure"] as Record<string, unknown>;
    const palette = structure["palette"] as { default: { block_palette: unknown[] } };
    const states = (palette.default.block_palette[0] as { states: Record<string, unknown> }).states;

    expect(states["pillar_axis"]).toBe("y");
    expect(states["deprecated"]).toBe(0);
    // Booleans round-trip through an NBT byte as 0/1.
    expect(states["upside_down_bit"]).toBe(1);
  });

  it("carries an explicit waterlog layer and a block-version override", async () => {
    const decoded = await decode(
      encodeMcStructure({
        size: { x: 1, y: 1, z: 2 },
        palette: [{ name: "minecraft:water" }],
        blocks: [-1, -1],
        waterlog: [0, -1],
        blockVersion: 12345,
      }),
    );
    const structure = decoded["structure"] as Record<string, unknown>;
    const indices = structure["block_indices"] as number[][];
    expect(indices[1]).toEqual([0, -1]);

    const palette = structure["palette"] as { default: { block_palette: { version: number }[] } };
    expect(palette.default.block_palette[0]?.version).toBe(12345);
  });

  it("rejects a block layer whose length does not match the size", () => {
    expect(() => encodeMcStructure({ ...sampleDefinition(), blocks: [0, 1, 2] })).toThrowError(
      /blocks must have 6 entries/,
    );
  });

  it("rejects a palette index outside the palette range", () => {
    expect(() =>
      encodeMcStructure({ ...sampleDefinition(), blocks: [0, 1, 2, 1, 0, -1] }),
    ).toThrowError(/outside the range -1\.\.1/);
  });

  it("rejects an empty palette and a non-positive extent", () => {
    expect(() =>
      encodeMcStructure({ size: { x: 1, y: 1, z: 1 }, palette: [], blocks: [-1] }),
    ).toThrowError(/palette must have at least one entry/);
    expect(() =>
      encodeMcStructure({
        size: { x: 0, y: 1, z: 1 },
        palette: [{ name: "minecraft:stone" }],
        blocks: [],
      }),
    ).toThrowError(/size\.x must be a positive integer/);
  });
});
