import { describe, expect, it } from "vitest";
import {
  PROTOCOL_VERSION,
  isProtocolCompatible,
  parseMajor,
} from "../../src/protocol/protocol-version.js";

describe("protocol version", () => {
  it("declares a semver version string", () => {
    expect(PROTOCOL_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("parses the major component", () => {
    expect(parseMajor("2.4.1")).toBe(2);
    expect(parseMajor("0.0.0")).toBe(0);
    expect(parseMajor("10.20.30")).toBe(10);
  });

  it("returns null for an unparseable version", () => {
    expect(parseMajor("not-a-version")).toBeNull();
    expect(parseMajor("1.2")).toBeNull();
    expect(parseMajor("")).toBeNull();
  });

  it("treats an equal major version as compatible", () => {
    const major = parseMajor(PROTOCOL_VERSION);
    expect(major).not.toBeNull();
    expect(isProtocolCompatible(`${major ?? 0}.99.99`)).toBe(true);
    expect(isProtocolCompatible(PROTOCOL_VERSION)).toBe(true);
  });

  it("treats a different major version as incompatible", () => {
    const major = parseMajor(PROTOCOL_VERSION) ?? 0;
    expect(isProtocolCompatible(`${major + 1}.0.0`)).toBe(false);
  });

  it("treats an unparseable peer version as incompatible", () => {
    expect(isProtocolCompatible("garbage")).toBe(false);
  });
});
