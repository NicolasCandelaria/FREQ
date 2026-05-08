export type KeyEstimate = { key: string | null; confidence: number };

const PITCH_CLASS_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B"
] as const;

// Krumhansl-Schmuckler key profiles.
const MAJOR_PROFILE = [
  6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88
];
const MINOR_PROFILE = [
  6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17
];

function rotate(values: readonly number[], semitones: number): number[] {
  const shift = ((semitones % 12) + 12) % 12;
  const rotated = new Array<number>(12);
  for (let index = 0; index < 12; index += 1) {
    rotated[index] = values[(index - shift + 12) % 12];
  }
  return rotated;
}

function pearsonCorrelation(left: readonly number[], right: readonly number[]): number {
  if (left.length !== right.length || left.length === 0) {
    return 0;
  }

  const length = left.length;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / length;

  let numerator = 0;
  let leftVariance = 0;
  let rightVariance = 0;

  for (let index = 0; index < length; index += 1) {
    const centeredLeft = left[index] - leftMean;
    const centeredRight = right[index] - rightMean;
    numerator += centeredLeft * centeredRight;
    leftVariance += centeredLeft * centeredLeft;
    rightVariance += centeredRight * centeredRight;
  }

  const denominator = Math.sqrt(leftVariance * rightVariance);
  if (denominator === 0) {
    return 0;
  }

  return numerator / denominator;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function estimateKeyFromChroma(chroma: number[]): KeyEstimate {
  if (chroma.length < 12) {
    return { key: null, confidence: 0 };
  }

  const chroma12 = chroma.slice(0, 12).map((value) => Math.max(0, value));
  const energy = chroma12.reduce((sum, value) => sum + value, 0);
  if (energy <= 0) {
    return { key: null, confidence: 0 };
  }

  let bestLabel: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  let secondBestScore = Number.NEGATIVE_INFINITY;

  for (let tonic = 0; tonic < 12; tonic += 1) {
    const majorScore = pearsonCorrelation(chroma12, rotate(MAJOR_PROFILE, tonic));
    if (majorScore > bestScore) {
      secondBestScore = bestScore;
      bestScore = majorScore;
      bestLabel = `${PITCH_CLASS_NAMES[tonic]} major`;
    } else if (majorScore > secondBestScore) {
      secondBestScore = majorScore;
    }

    const minorScore = pearsonCorrelation(chroma12, rotate(MINOR_PROFILE, tonic));
    if (minorScore > bestScore) {
      secondBestScore = bestScore;
      bestScore = minorScore;
      bestLabel = `${PITCH_CLASS_NAMES[tonic]} minor`;
    } else if (minorScore > secondBestScore) {
      secondBestScore = minorScore;
    }
  }

  if (bestLabel === null || !Number.isFinite(bestScore)) {
    return { key: null, confidence: 0 };
  }

  // Blend absolute fit and separation from next-best key.
  const normalizedBest = clamp01((bestScore + 1) / 2);
  const margin = clamp01((bestScore - secondBestScore) / 2);
  const confidence = clamp01(0.7 * normalizedBest + 0.3 * margin);

  return { key: bestLabel, confidence };
}

export function estimateKey(chroma: number[]): KeyEstimate {
  return estimateKeyFromChroma(chroma);
}
