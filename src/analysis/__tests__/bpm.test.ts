import { describe, expect, it } from "vitest";
import { estimateBpmFromOnsets } from "../bpm";

describe("estimateBpmFromOnsets", () => {
  it("throws when minBpm is not greater than 0", () => {
    expect(() =>
      estimateBpmFromOnsets([0, 0.5, 1], { minBpm: 0, maxBpm: 180 })
    ).toThrow("minBpm must be greater than 0");
  });

  it("throws when maxBpm is not greater than 0", () => {
    expect(() =>
      estimateBpmFromOnsets([0, 0.5, 1], { minBpm: 70, maxBpm: 0 })
    ).toThrow("maxBpm must be greater than 0");
  });

  it("throws when minBpm is greater than maxBpm", () => {
    expect(() =>
      estimateBpmFromOnsets([0, 0.5, 1], { minBpm: 181, maxBpm: 180 })
    ).toThrow("minBpm must be less than or equal to maxBpm");
  });

  it("returns null bpm with zero confidence for low-information input", () => {
    expect(estimateBpmFromOnsets([], { minBpm: 70, maxBpm: 180 })).toEqual({
      bpm: null,
      confidence: 0
    });
    expect(
      estimateBpmFromOnsets([0, 0.5], { minBpm: 70, maxBpm: 180 })
    ).toEqual({
      bpm: null,
      confidence: 0
    });
  });

  it("detects approx 120 BPM from regular pulse intervals", () => {
    const onsets = [0, 0.5, 1.0, 1.5, 2.0, 2.5];
    const result = estimateBpmFromOnsets(onsets, { minBpm: 70, maxBpm: 180 });

    expect(result.bpm).not.toBeNull();
    expect(Math.abs((result.bpm ?? 0) - 120)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it("produces lower confidence for noisy intervals than steady intervals", () => {
    const steady = estimateBpmFromOnsets([0, 0.5, 1.0, 1.5, 2.0, 2.5], {
      minBpm: 70,
      maxBpm: 180
    });
    const noisy = estimateBpmFromOnsets([0, 0.42, 0.95, 1.41, 1.98, 2.37], {
      minBpm: 70,
      maxBpm: 180
    });

    expect(noisy.confidence).toBeLessThan(steady.confidence);
  });
});
