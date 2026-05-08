import { describe, expect, it } from "vitest";

describe("vitest setup", () => {
  it("runs tests in a browser-like environment", () => {
    expect(globalThis.window).toBeDefined();
  });
});
