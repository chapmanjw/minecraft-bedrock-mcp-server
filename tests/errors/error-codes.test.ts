import { describe, expect, it } from "vitest";
import { ERROR_CODES, isErrorCode } from "../../src/errors/error-codes.js";

describe("error codes", () => {
  it("exposes a non-empty, duplicate-free set of codes", () => {
    expect(ERROR_CODES.length).toBeGreaterThan(0);
    expect(new Set(ERROR_CODES).size).toBe(ERROR_CODES.length);
  });

  it("recognizes known codes", () => {
    expect(isErrorCode("COMMAND_TIMEOUT")).toBe(true);
    expect(isErrorCode("BRIDGE_DISCONNECTED")).toBe(true);
  });

  it("rejects unknown codes", () => {
    expect(isErrorCode("definitely_not_a_code")).toBe(false);
    expect(isErrorCode("")).toBe(false);
  });
});
