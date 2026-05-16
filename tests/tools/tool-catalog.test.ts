import { describe, expect, it } from "vitest";
import { allTools } from "../../src/tools/index.js";

describe("tool catalog", () => {
  it("exposes the full tool surface", () => {
    expect(allTools.length).toBeGreaterThanOrEqual(70);
  });

  it("gives every tool a unique name", () => {
    const names = allTools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("names every tool mc_<domain>_<action>", () => {
    for (const tool of allTools) {
      expect(tool.name).toMatch(/^mc_[a-z]+(?:_[a-z]+)+$/);
    }
  });

  it("gives every tool a non-empty title and description", () => {
    for (const tool of allTools) {
      expect(tool.title.length, tool.name).toBeGreaterThan(0);
      expect(tool.description.length, tool.name).toBeGreaterThan(0);
    }
  });

  it("gives every tool an object input shape", () => {
    for (const tool of allTools) {
      expect(typeof tool.inputShape, tool.name).toBe("object");
    }
  });
});
