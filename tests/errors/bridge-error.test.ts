import { describe, expect, it } from "vitest";
import { BridgeError } from "../../src/errors/bridge-error.js";

describe("BridgeError", () => {
  it("is an Error carrying a stable code and message", () => {
    const error = new BridgeError({ code: "COMMAND_TIMEOUT", message: "took too long" });
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("BridgeError");
    expect(error.code).toBe("COMMAND_TIMEOUT");
    expect(error.message).toBe("took too long");
  });

  it("preserves optional details, retry hint, and cause", () => {
    const cause = new Error("root cause");
    const error = new BridgeError({
      code: "COMMAND_THROTTLED",
      message: "slow down",
      details: { kind: "mc_block_set" },
      retryAfterMs: 250,
      cause,
    });
    expect(error.details).toEqual({ kind: "mc_block_set" });
    expect(error.retryAfterMs).toBe(250);
    expect(error.cause).toBe(cause);
  });

  it("leaves optional fields undefined when omitted", () => {
    const error = new BridgeError({ code: "INTERNAL", message: "boom" });
    expect(error.details).toBeUndefined();
    expect(error.retryAfterMs).toBeUndefined();
  });

  it("identifies its own instances with the static guard", () => {
    expect(BridgeError.is(new BridgeError({ code: "INTERNAL", message: "x" }))).toBe(true);
    expect(BridgeError.is(new Error("plain"))).toBe(false);
    expect(BridgeError.is("not an error")).toBe(false);
    expect(BridgeError.is(undefined)).toBe(false);
  });

  it("serializes to a wire-safe shape, omitting absent details", () => {
    const error = new BridgeError({ code: "NOT_FOUND", message: "missing" });
    expect(error.serialize()).toEqual({ code: "NOT_FOUND", message: "missing" });
    expect("details" in error.serialize()).toBe(false);
  });

  it("serializes details when present", () => {
    const error = new BridgeError({
      code: "INVALID_INPUT",
      message: "bad field",
      details: { field: "dimension" },
    });
    expect(error.serialize()).toEqual({
      code: "INVALID_INPUT",
      message: "bad field",
      details: { field: "dimension" },
    });
  });
});
