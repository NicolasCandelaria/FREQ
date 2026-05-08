import { describe, expect, it } from "vitest";
import { estimateKeyFromChroma } from "../key";

function rotate(values: readonly number[], semitones: number): number[] {
  const shift = ((semitones % 12) + 12) % 12;
  const rotated = new Array<number>(12);
  for (let index = 0; index < 12; index += 1) {
    rotated[index] = values[(index - shift + 12) % 12];
  }
  return rotated;
}

describe("estimateKeyFromChroma", () => {
  it("returns null key with zero confidence for empty chroma", () => {
    expect(estimateKeyFromChroma([])).toEqual({
      key: null,
      confidence: 0
    });
  });

  it("detects C major from a C major weighted chroma profile", () => {
    const cMajorLike = [
      6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
    ];

    const result = estimateKeyFromChroma(cMajorLike);

    expect(result.key).toBe("C major");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("detects A minor from an A minor weighted chroma profile", () => {
    const cMinorLike = [
      6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
    ];
    const aMinorLike = rotate(cMinorLike, 9);

    const result = estimateKeyFromChroma(aMinorLike);

    expect(result.key).toBe("A minor");
    expect(result.confidence).toBeGreaterThan(0.7);
  });

  it("produces lower confidence for ambiguous chroma than tonal chroma", () => {
    const ambiguous = new Array<number>(12).fill(1);
    const tonal = [
      6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
    ];

    const ambiguousResult = estimateKeyFromChroma(ambiguous);
    const tonalResult = estimateKeyFromChroma(tonal);

    expect(ambiguousResult.confidence).toBeLessThan(tonalResult.confidence);
  });
});
