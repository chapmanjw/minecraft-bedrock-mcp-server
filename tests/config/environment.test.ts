import { describe, expect, it } from "vitest";
import { ConfigError } from "../../src/config/config-error.js";
import { corsOrigins, loadEnvironment } from "../../src/config/environment.js";

const REQUIRED: Record<string, string> = {
  BRIDGE_CLIENT_TOKEN: "client-secret",
  BRIDGE_AGENT_TOKEN: "agent-secret",
  BRIDGE_WORLD_PATH: "/srv/world",
  BRIDGE_BEHAVIOR_PACK_PATH: "/srv/world/behavior_packs/bridge",
};

describe("loadEnvironment", () => {
  it("applies defaults when only required variables are set", () => {
    const env = loadEnvironment(REQUIRED);
    expect(env.BRIDGE_HOST).toBe("0.0.0.0");
    expect(env.BRIDGE_PORT).toBe(8765);
    expect(env.BRIDGE_LOG_LEVEL).toBe("info");
    expect(env.BRIDGE_POLL_TIMEOUT_MS).toBe(30_000);
    expect(env.BRIDGE_TRUST_PROXY).toBe(false);
  });

  it("throws ConfigError when a required variable is missing", () => {
    const { BRIDGE_CLIENT_TOKEN: _omitted, ...rest } = REQUIRED;
    expect(() => loadEnvironment(rest)).toThrow(ConfigError);
  });

  it("coerces numeric variables from strings", () => {
    expect(loadEnvironment({ ...REQUIRED, BRIDGE_PORT: "9000" }).BRIDGE_PORT).toBe(9000);
  });

  it("rejects an out-of-range port", () => {
    expect(() => loadEnvironment({ ...REQUIRED, BRIDGE_PORT: "70000" })).toThrow(ConfigError);
  });

  it("rejects a non-numeric timeout", () => {
    expect(() => loadEnvironment({ ...REQUIRED, BRIDGE_POLL_TIMEOUT_MS: "soon" })).toThrow(
      ConfigError,
    );
  });

  it("parses BRIDGE_TRUST_PROXY as a boolean", () => {
    expect(loadEnvironment({ ...REQUIRED, BRIDGE_TRUST_PROXY: "true" }).BRIDGE_TRUST_PROXY).toBe(
      true,
    );
    expect(loadEnvironment({ ...REQUIRED, BRIDGE_TRUST_PROXY: "false" }).BRIDGE_TRUST_PROXY).toBe(
      false,
    );
  });

  it("rejects a non-boolean BRIDGE_TRUST_PROXY", () => {
    expect(() => loadEnvironment({ ...REQUIRED, BRIDGE_TRUST_PROXY: "yes" })).toThrow(ConfigError);
  });

  it("rejects an unknown log level", () => {
    expect(() => loadEnvironment({ ...REQUIRED, BRIDGE_LOG_LEVEL: "verbose" })).toThrow(
      ConfigError,
    );
  });
});

describe("corsOrigins", () => {
  it("returns null when CORS is not configured", () => {
    expect(corsOrigins(loadEnvironment(REQUIRED))).toBeNull();
  });

  it("splits and trims a comma-separated origin list", () => {
    const env = loadEnvironment({
      ...REQUIRED,
      BRIDGE_CORS_ORIGINS: "https://a.example.com, https://b.example.com",
    });
    expect(corsOrigins(env)).toEqual(["https://a.example.com", "https://b.example.com"]);
  });

  it("returns null for a blank origin list", () => {
    expect(corsOrigins(loadEnvironment({ ...REQUIRED, BRIDGE_CORS_ORIGINS: "  ,  " }))).toBeNull();
  });
});
