import { describe, expect, it } from "vitest";
import { getWindowIndexAtX } from "./timelineCanvas";

describe("getWindowIndexAtX", () => {
  it("returns window index based on x position", () => {
    expect(getWindowIndexAtX(50, 500, 10)).toBe(1);
  });

  it("clamps to the first and last indices", () => {
    expect(getWindowIndexAtX(-10, 500, 10)).toBe(0);
    expect(getWindowIndexAtX(500, 500, 10)).toBe(9);
  });

  it("returns 0 when pointer x is not finite", () => {
    expect(getWindowIndexAtX(Number.NaN, 500, 10)).toBe(0);
    expect(getWindowIndexAtX(Number.POSITIVE_INFINITY, 500, 10)).toBe(0);
  });
});
