import { describe, expect, it } from "vitest";
import { confidencePillModifiers, getConfidenceTier } from "./confidenceTier";

describe("getConfidenceTier", () => {
  it("maps confidence to tooltip pill tiers", () => {
    expect(getConfidenceTier(0)).toBe("low");
    expect(getConfidenceTier(0.44)).toBe("low");
    expect(getConfidenceTier(0.45)).toBe("medium");
    expect(getConfidenceTier(0.74)).toBe("medium");
    expect(getConfidenceTier(0.75)).toBe("high");
    expect(getConfidenceTier(1)).toBe("high");
  });

  it("clamps out-of-range values", () => {
    expect(getConfidenceTier(-5)).toBe("low");
    expect(getConfidenceTier(99)).toBe("high");
  });

  it("computes stacked CSS modifier classes", () => {
    expect(confidencePillModifiers(0.74)).toBe("confidence-pill confidence-pill--medium");
    expect(confidencePillModifiers(0.75)).toBe("confidence-pill confidence-pill--high");
  });
});
