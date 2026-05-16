import { describe, expect, it } from "vitest";
import { CommandSchema, PollResponseSchema } from "../../src/protocol/command.js";

const VALID_ID = "cmd_0123456789ABCDEFGHJKMNPQRS";

const validCommand = {
  id: VALID_ID,
  kind: "mc_block_set",
  payload: { dimension: "overworld" },
  issued_at: "2026-05-15T12:00:00.000Z",
  deadline_ms: 15_000,
};

describe("CommandSchema", () => {
  it("accepts a well-formed command", () => {
    expect(CommandSchema.parse(validCommand)).toEqual(validCommand);
  });

  it("accepts any JSON payload", () => {
    expect(CommandSchema.safeParse({ ...validCommand, payload: [1, 2, 3] }).success).toBe(true);
    expect(CommandSchema.safeParse({ ...validCommand, payload: null }).success).toBe(true);
  });

  it("rejects an id that is not a cmd_<ULID>", () => {
    expect(CommandSchema.safeParse({ ...validCommand, id: "cmd_short" }).success).toBe(false);
    expect(
      CommandSchema.safeParse({ ...validCommand, id: "xyz_0123456789ABCDEFGHJKMNPQRS" }).success,
    ).toBe(false);
  });

  it("rejects an empty kind", () => {
    expect(CommandSchema.safeParse({ ...validCommand, kind: "" }).success).toBe(false);
  });

  it("rejects a non-positive or fractional deadline", () => {
    expect(CommandSchema.safeParse({ ...validCommand, deadline_ms: 0 }).success).toBe(false);
    expect(CommandSchema.safeParse({ ...validCommand, deadline_ms: -1 }).success).toBe(false);
    expect(CommandSchema.safeParse({ ...validCommand, deadline_ms: 12.5 }).success).toBe(false);
  });

  it("rejects a non-ISO issued_at", () => {
    expect(CommandSchema.safeParse({ ...validCommand, issued_at: "yesterday" }).success).toBe(
      false,
    );
  });
});

describe("PollResponseSchema", () => {
  it("accepts an envelope of commands", () => {
    const response = { commands: [validCommand], server_time: "2026-05-15T12:00:01.000Z" };
    expect(PollResponseSchema.parse(response)).toEqual(response);
  });

  it("accepts an empty command list", () => {
    expect(
      PollResponseSchema.safeParse({ commands: [], server_time: "2026-05-15T12:00:01.000Z" })
        .success,
    ).toBe(true);
  });

  it("rejects a non-ISO server_time", () => {
    expect(PollResponseSchema.safeParse({ commands: [], server_time: "soon" }).success).toBe(false);
  });
});
