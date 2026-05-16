import { describe, expect, it } from "vitest";
import { BridgeError } from "../../src/errors/bridge-error.js";
import {
  toCallToolResult,
  toErrorResult,
  toolError,
  toolSuccess,
} from "../../src/tools/tool-result.js";

describe("tool result envelope", () => {
  it("wraps successful data as structured content", () => {
    const result = toolSuccess({ worldName: "Test" });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({ result: { worldName: "Test" } });
    expect(result.content[0]).toMatchObject({ type: "text" });
  });

  it("wraps an error with its code and details", () => {
    const result = toolError("NOT_FOUND", "missing", { id: "x" });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: { code: "NOT_FOUND", message: "missing", details: { id: "x" } },
    });
  });

  it("omits absent error details", () => {
    const result = toolError("INTERNAL", "boom");
    expect(result.structuredContent).toEqual({ error: { code: "INTERNAL", message: "boom" } });
  });

  it("maps an ok command result to a success envelope", () => {
    const result = toCallToolResult({ id: "cmd_x", status: "ok", result: { placed: 3 } });
    expect(result.isError).toBe(false);
    expect(result.structuredContent).toEqual({ result: { placed: 3 } });
  });

  it("maps an error command result to an error envelope", () => {
    const result = toCallToolResult({
      id: "cmd_x",
      status: "error",
      error: { code: "BEHAVIOR_PACK_ERROR", message: "blocked" },
    });
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toEqual({
      error: { code: "BEHAVIOR_PACK_ERROR", message: "blocked" },
    });
  });

  it("maps a BridgeError to an error envelope carrying its code", () => {
    const result = toErrorResult(new BridgeError({ code: "QUEUE_FULL", message: "full" }));
    expect(result.structuredContent).toEqual({ error: { code: "QUEUE_FULL", message: "full" } });
  });

  it("maps an unknown error to INTERNAL", () => {
    const result = toErrorResult(new Error("kaboom"));
    expect(result.isError).toBe(true);
    expect(result.structuredContent).toMatchObject({ error: { code: "INTERNAL" } });
  });
});
