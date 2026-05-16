import { readFileSync } from "node:fs";
import { ConfigError } from "./config-error.js";
import type { Environment } from "./environment.js";

/** TLS certificate and private key material, loaded into memory. */
export interface TlsMaterial {
  readonly cert: Buffer;
  readonly key: Buffer;
}

/**
 * Loads TLS material from the configured certificate and key paths.
 *
 * @returns The material when both paths are set; `null` when neither is set,
 *   in which case the server listens over plain HTTP.
 * @throws {ConfigError} when exactly one path is set, or a file cannot be read.
 */
export function loadTlsMaterial(env: Environment): TlsMaterial | null {
  const certPath = env.BRIDGE_TLS_CERT;
  const keyPath = env.BRIDGE_TLS_KEY;

  if (certPath === undefined && keyPath === undefined) return null;
  if (certPath === undefined || keyPath === undefined) {
    throw new ConfigError(
      "BRIDGE_TLS_CERT and BRIDGE_TLS_KEY must be set together, or both left unset",
    );
  }

  try {
    return { cert: readFileSync(certPath), key: readFileSync(keyPath) };
  } catch (cause) {
    throw new ConfigError(`unable to read TLS material (cert: ${certPath}, key: ${keyPath})`, {
      cause,
    });
  }
}
