/**
 * Encodes a block-grid definition into the Bedrock `.mcstructure` binary format.
 *
 * A `.mcstructure` file is uncompressed, little-endian NBT with no Bedrock
 * level header. The schema is documented at `wiki.bedrock.dev/nbt/mcstructure`:
 *
 * - `format_version` — always 1.
 * - `size` — the X/Y/Z extents.
 * - `structure_world_origin` — the capture origin; `[0,0,0]` for a synthetic
 *   structure.
 * - `structure.block_indices` — two parallel layers (primary, then a secondary
 *   waterlog layer), each `size.x * size.y * size.z` entries in ZYX order. An
 *   entry of `-1` is a structure void: the block already in the world is left
 *   untouched when the structure is placed.
 * - `structure.palette.default.block_palette` — the distinct block states the
 *   index layers refer into.
 *
 * The binary NBT layer is delegated to `prismarine-nbt`; this module only
 * assembles the tag tree and enforces the structural invariants.
 */
import nbt from "prismarine-nbt";
import { BridgeError } from "../errors/bridge-error.js";

/** A distinct block state in a structure's palette. */
export interface PaletteEntry {
  readonly name: string;
  readonly states?: Readonly<Record<string, string | number | boolean>>;
}

/** A client-supplied description of a structure to encode. */
export interface StructureDefinition {
  readonly size: { readonly x: number; readonly y: number; readonly z: number };
  readonly palette: readonly PaletteEntry[];
  /** Primary block layer: one palette index per cell, ZYX order, `-1` = void. */
  readonly blocks: readonly number[];
  /** Optional secondary (waterlog) layer; same length as {@link blocks}. */
  readonly waterlog?: readonly number[];
  /** Block compatibility version stamped on every palette entry. */
  readonly blockVersion?: number;
}

/** Packs a Minecraft `major.minor.patch.revision` into the block `version` int. */
function packVersion(major: number, minor: number, patch: number, revision: number): number {
  return (major << 24) | (minor << 16) | (patch << 8) | revision;
}

/**
 * The block `version` stamped on every palette entry when the caller does not
 * supply one. Its four bytes encode a Minecraft version — 1.21.0 here, the
 * behavior pack's minimum engine version. Block names and states produced for
 * current Minecraft need a recent value so Bedrock's block upgrader leaves them
 * untouched; a caller targeting an older server can override it per upload.
 */
export const DEFAULT_BLOCK_VERSION = packVersion(1, 21, 0, 0);

/** A prismarine-nbt tag node. */
type Tag = { type: string; value: unknown };

function fail(message: string): never {
  throw new BridgeError({ code: "INVALID_INPUT", message });
}

/** Encodes one palette entry's block states as an NBT compound. */
function encodeStates(states: Readonly<Record<string, string | number | boolean>>): Tag {
  const value: Record<string, Tag> = {};
  for (const [name, state] of Object.entries(states)) {
    if (typeof state === "boolean") {
      // Bedrock boolean block states are stored as NBT bytes.
      value[name] = { type: "byte", value: state ? 1 : 0 };
    } else if (typeof state === "number") {
      value[name] = { type: "int", value: state };
    } else {
      value[name] = { type: "string", value: state };
    }
  }
  return { type: "compound", value };
}

/**
 * Encodes a {@link StructureDefinition} into `.mcstructure` file bytes.
 *
 * @throws {BridgeError} `INVALID_INPUT` when the definition is inconsistent —
 * a non-positive extent, a layer whose length does not match the volume, or a
 * palette index outside `-1..palette.length - 1`.
 */
export function encodeMcStructure(def: StructureDefinition): Buffer {
  const { x, y, z } = def.size;
  for (const [axis, extent] of [
    ["x", x],
    ["y", y],
    ["z", z],
  ] as const) {
    if (!Number.isInteger(extent) || extent <= 0) {
      fail(`size.${axis} must be a positive integer`);
    }
  }
  if (def.palette.length === 0) fail("palette must have at least one entry");

  const volume = x * y * z;
  if (def.blocks.length !== volume) {
    fail(`blocks must have ${volume} entries to match size, got ${def.blocks.length}`);
  }
  if (def.waterlog !== undefined && def.waterlog.length !== volume) {
    fail(`waterlog must have ${volume} entries to match size, got ${def.waterlog.length}`);
  }

  const maxIndex = def.palette.length - 1;
  const checkLayer = (layer: readonly number[], label: string): void => {
    for (const index of layer) {
      if (!Number.isInteger(index) || index < -1 || index > maxIndex) {
        fail(`${label} contains index ${index}, outside the range -1..${maxIndex}`);
      }
    }
  };
  checkLayer(def.blocks, "blocks");
  if (def.waterlog !== undefined) checkLayer(def.waterlog, "waterlog");

  // A structure void (-1) in the waterlog layer leaves that layer untouched.
  const waterlog = def.waterlog ?? new Array<number>(volume).fill(-1);
  const version = def.blockVersion ?? DEFAULT_BLOCK_VERSION;

  // In a prismarine-nbt list whose element type is `compound`, each element is
  // the bare field record — the `compound` type is already named by the list.
  const blockPalette: Record<string, Tag>[] = def.palette.map((entry) => ({
    name: { type: "string", value: entry.name },
    states: encodeStates(entry.states ?? {}),
    version: { type: "int", value: version },
  }));

  const root = {
    type: "compound",
    name: "",
    value: {
      format_version: { type: "int", value: 1 },
      size: { type: "list", value: { type: "int", value: [x, y, z] } },
      structure_world_origin: { type: "list", value: { type: "int", value: [0, 0, 0] } },
      structure: {
        type: "compound",
        value: {
          block_indices: {
            type: "list",
            value: {
              type: "list",
              value: [
                { type: "int", value: [...def.blocks] },
                { type: "int", value: [...waterlog] },
              ],
            },
          },
          entities: { type: "list", value: { type: "compound", value: [] } },
          palette: {
            type: "compound",
            value: {
              default: {
                type: "compound",
                value: {
                  block_palette: { type: "list", value: { type: "compound", value: blockPalette } },
                  block_position_data: { type: "compound", value: {} },
                },
              },
            },
          },
        },
      },
    },
  };

  return nbt.writeUncompressed(root as Parameters<typeof nbt.writeUncompressed>[0], "little");
}
