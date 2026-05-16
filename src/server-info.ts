import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";

const ManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
});

/**
 * Reads the package manifest that ships beside the compiled output (and beside
 * `src/` during development), so the name and version stay in sync with npm.
 */
function readManifest(): z.infer<typeof ManifestSchema> {
  const manifestPath = join(import.meta.dirname, "../package.json");
  const raw: unknown = JSON.parse(readFileSync(manifestPath, "utf8"));
  return ManifestSchema.parse(raw);
}

const manifest = readManifest();

/** The npm package name. */
export const SERVER_NAME = manifest.name;

/** The npm package version. */
export const SERVER_VERSION = manifest.version;
