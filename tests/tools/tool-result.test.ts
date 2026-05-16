import { encode } from "@toon-format/toon";
import { describe, expect, it } from "vitest";
import { BridgeError } from "../../src/errors/bridge-error.js";
import {
  toCallToolResult,
  toErrorResult,
  toolError,
  toolSuccess,
} from "../../src/tools/tool-result.js";

/** Reads the single TOON text block carried by a tool result. */
function textOf(result: { content: { type: string; text?: string }[] }): string {
  expect(result.content).toHaveLength(1);
  expect(result.content[0]).toMatchObject({ type: "text" });
  return result.content[0]!.text!;
}

describe("tool result envelope", () => {
  it("encodes successful data as a single TOON text block", () => {
    const result = toolSuccess({ worldName: "Test" });
    expect(result.isError).toBe(false);
    expect(textOf(result)).toBe(encode({ worldName: "Test" }));
  });

  it("emits no redundant structuredContent copy", () => {
    expect(toolSuccess({ worldName: "Test" }).structuredContent).toBeUndefined();
    expect(toolError("INTERNAL", "boom").structuredContent).toBeUndefined();
  });

  it("encodes a tabular result without a wrapping key", () => {
    const players = [
      { name: "Alice", x: 10 },
      { name: "Bob", x: 22 },
    ];
    const text = textOf(toolSuccess(players));
    expect(text).toBe(encode(players));
    expect(text.startsWith("[2]{name,x}:")).toBe(true);
  });

  it("renders undefined data as a no-content marker", () => {
    expect(textOf(toolSuccess(undefined))).toBe("(no content)");
  });

  it("encodes an error with its code and details", () => {
    const result = toolError("NOT_FOUND", "missing", { id: "x" });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      encode({ error: { code: "NOT_FOUND", message: "missing", details: { id: "x" } } }),
    );
  });

  it("omits absent error details", () => {
    const result = toolError("INTERNAL", "boom");
    expect(textOf(result)).toBe(encode({ error: { code: "INTERNAL", message: "boom" } }));
  });

  it("maps an ok command result to a success envelope", () => {
    const result = toCallToolResult({ id: "cmd_x", status: "ok", result: { placed: 3 } });
    expect(result.isError).toBe(false);
    expect(textOf(result)).toBe(encode({ placed: 3 }));
  });

  it("maps an error command result to an error envelope", () => {
    const result = toCallToolResult({
      id: "cmd_x",
      status: "error",
      error: { code: "BEHAVIOR_PACK_ERROR", message: "blocked" },
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      encode({ error: { code: "BEHAVIOR_PACK_ERROR", message: "blocked" } }),
    );
  });

  it("maps a BridgeError to an error envelope carrying its code", () => {
    const result = toErrorResult(new BridgeError({ code: "QUEUE_FULL", message: "full" }));
    expect(textOf(result)).toBe(encode({ error: { code: "QUEUE_FULL", message: "full" } }));
  });

  it("maps an unknown error to INTERNAL", () => {
    const result = toErrorResult(new Error("kaboom"));
    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(encode({ error: { code: "INTERNAL", message: "kaboom" } }));
  });
});
