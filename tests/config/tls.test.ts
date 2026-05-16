import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ConfigError } from "../../src/config/config-error.js";
import { loadEnvironment, type Environment } from "../../src/config/environment.js";
import { loadTlsMaterial } from "../../src/config/tls.js";

function environmentWithTls(certPath?: string, keyPath?: string): Environment {
  return loadEnvironment({
    BRIDGE_CLIENT_TOKEN: "client-secret",
    BRIDGE_AGENT_TOKEN: "agent-secret",
    BRIDGE_WORLD_PATH: "/srv/world",
    BRIDGE_BEHAVIOR_PACK_PATH: "/srv/world/behavior_packs/bridge",
    ...(certPath === undefined ? {} : { BRIDGE_TLS_CERT: certPath }),
    ...(keyPath === undefined ? {} : { BRIDGE_TLS_KEY: keyPath }),
  });
}

describe("loadTlsMaterial", () => {
  let tempDir: string;
  let certPath: string;
  let keyPath: string;

  beforeAll(() => {
    tempDir = mkdtempSync(join(tmpdir(), "bridge-tls-"));
    certPath = join(tempDir, "cert.pem");
    keyPath = join(tempDir, "key.pem");
    writeFileSync(certPath, "TEST-CERT");
    writeFileSync(keyPath, "TEST-KEY");
  });
  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns null when neither TLS path is set", () => {
    expect(loadTlsMaterial(environmentWithTls())).toBeNull();
  });

  it("throws when only the certificate path is set", () => {
    expect(() => loadTlsMaterial(environmentWithTls(certPath, undefined))).toThrow(ConfigError);
  });

  it("throws when only the key path is set", () => {
    expect(() => loadTlsMaterial(environmentWithTls(undefined, keyPath))).toThrow(ConfigError);
  });

  it("loads certificate and key material when both paths are set", () => {
    const material = loadTlsMaterial(environmentWithTls(certPath, keyPath));
    expect(material?.cert.toString()).toBe("TEST-CERT");
    expect(material?.key.toString()).toBe("TEST-KEY");
  });

  it("throws when a configured TLS file cannot be read", () => {
    expect(() =>
      loadTlsMaterial(environmentWithTls(join(tempDir, "missing.pem"), keyPath)),
    ).toThrow(ConfigError);
  });
});
