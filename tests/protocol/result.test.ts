import { describe, expect, it } from "vitest";
import { CommandResultSchema } from "../../src/protocol/result.js";

const VALID_ID = "cmd_0123456789ABCDEFGHJKMNPQRS";

describe("CommandResultSchema", () => {
  it("accepts an ok result with a payload", () => {
    const result = { id: VALID_ID, status: "ok", result: { placed: 1 } };
    expect(CommandResultSchema.parse(result)).toEqual(result);
  });

  it("accepts an ok result with no payload", () => {
    expect(CommandResultSchema.safeParse({ id: VALID_ID, status: "ok" }).success).toBe(true);
  });

  it("accepts an error result", () => {
    const result = {
      id: VALID_ID,
      status: "error",
      error: { code: "BEHAVIOR_PACK_ERROR", message: "block is protected" },
    };
    expect(CommandResultSchema.parse(result)).toEqual(result);
  });

  it("accepts optional structured error details", () => {
    const result = {
      id: VALID_ID,
      status: "error",
      error: { code: "NOT_FOUND", message: "no such entity", details: { entityId: "e1" } },
    };
    expect(CommandResultSchema.safeParse(result).success).toBe(true);
  });

  it("rejects an error result without an error object", () => {
    expect(CommandResultSchema.safeParse({ id: VALID_ID, status: "error" }).success).toBe(false);
  });

  it("rejects an error object missing its code", () => {
    expect(
      CommandResultSchema.safeParse({
        id: VALID_ID,
        status: "error",
        error: { message: "no code here" },
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown status", () => {
    expect(
      CommandResultSchema.safeParse({ id: VALID_ID, status: "maybe", result: {} }).success,
    ).toBe(false);
  });

  it("rejects a result with no status discriminator", () => {
    expect(CommandResultSchema.safeParse({ id: VALID_ID, result: {} }).success).toBe(false);
  });
});
