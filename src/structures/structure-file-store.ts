import { mkdir, readFile, readdir, stat, unlink, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { BridgeError } from "../errors/bridge-error.js";

const STRUCTURE_EXTENSION = ".mcstructure";

/** Metadata for a `.mcstructure` file. */
export interface StructureFileInfo {
  readonly name: string;
  readonly bytes: number;
}

/**
 * Filesystem access to the `.mcstructure` files in the behavior pack's
 * `structures` folder. Every file name is confined to that folder.
 */
export interface StructureFileStore {
  /** Lists the `.mcstructure` files present. */
  list(): Promise<StructureFileInfo[]>;
  /** Reads a structure file's raw bytes. */
  read(name: string): Promise<Buffer>;
  /** Writes a structure file, creating the folder if needed. */
  write(name: string, data: Buffer): Promise<StructureFileInfo>;
  /** Deletes a structure file; `false` if it did not exist. */
  remove(name: string): Promise<boolean>;
}

function isErrno(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

/** Creates a {@link StructureFileStore} rooted at `rootDir`. */
export function createStructureFileStore(rootDir: string): StructureFileStore {
  const root = resolve(rootDir);

  /** Resolves a caller-supplied name to an absolute path inside `root`. */
  function resolveFile(name: string): string {
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed !== basename(trimmed) || trimmed.includes("..")) {
      throw new BridgeError({
        code: "STRUCTURE_FILE_ERROR",
        message: `invalid structure file name '${name}'`,
      });
    }
    const fileName = trimmed.endsWith(STRUCTURE_EXTENSION)
      ? trimmed
      : `${trimmed}${STRUCTURE_EXTENSION}`;
    return join(root, fileName);
  }

  return {
    async list() {
      let entries: string[];
      try {
        entries = await readdir(root);
      } catch (error) {
        if (isErrno(error) && error.code === "ENOENT") return [];
        throw new BridgeError({
          code: "STRUCTURE_FILE_ERROR",
          message: "unable to list the structures folder",
          cause: error,
        });
      }
      const files: StructureFileInfo[] = [];
      for (const entry of entries) {
        if (!entry.endsWith(STRUCTURE_EXTENSION)) continue;
        const info = await stat(join(root, entry));
        files.push({ name: entry, bytes: info.size });
      }
      return files;
    },

    async read(name) {
      const path = resolveFile(name);
      try {
        return await readFile(path);
      } catch (error) {
        if (isErrno(error) && error.code === "ENOENT") {
          throw new BridgeError({ code: "NOT_FOUND", message: `no structure file '${name}'` });
        }
        throw new BridgeError({
          code: "STRUCTURE_FILE_ERROR",
          message: `unable to read structure file '${name}'`,
          cause: error,
        });
      }
    },

    async write(name, data) {
      const path = resolveFile(name);
      await mkdir(root, { recursive: true });
      await writeFile(path, data);
      return { name: basename(path), bytes: data.byteLength };
    },

    async remove(name) {
      const path = resolveFile(name);
      try {
        await unlink(path);
        return true;
      } catch (error) {
        if (isErrno(error) && error.code === "ENOENT") return false;
        throw new BridgeError({
          code: "STRUCTURE_FILE_ERROR",
          message: `unable to delete structure file '${name}'`,
          cause: error,
        });
      }
    },
  };
}
