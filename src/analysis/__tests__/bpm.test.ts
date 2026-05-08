import { describe, expect, it } from "vitest";
import { estimateBpmFromOnsets } from "../bpm";

describe("estimateBpmFromOnsets", () => {
  it("detects approx 120 BPM from regular pulse intervals", () => {
    const onsets = [0, 0.5, 1.0, 1.5, 2.0, 2.5];
    const result = estimateBpmFromOnsets(onsets, { minBpm: 70, maxBpm: 180 });

    expect(result.bpm).not.toBeNull();
    expect(Math.abs((result.bpm ?? 0) - 120)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
