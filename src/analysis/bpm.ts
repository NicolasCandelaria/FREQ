export type BpmEstimate = { bpm: number | null; confidence: number };

export function estimateBpmFromOnsets(
  onsetTimesSec: number[],
  opts: { minBpm: number; maxBpm: number }
): BpmEstimate {
  if (onsetTimesSec.length < 3) {
    return { bpm: null, confidence: 0 };
  }

  const intervals: number[] = [];
  for (let index = 1; index < onsetTimesSec.length; index += 1) {
    intervals.push(onsetTimesSec[index] - onsetTimesSec[index - 1]);
  }

  const avgInterval =
    intervals.reduce((sum, value) => sum + value, 0) / intervals.length;
  if (avgInterval <= 0) {
    return { bpm: null, confidence: 0 };
  }

  let bpm = 60 / avgInterval;
  while (bpm < opts.minBpm) {
    bpm *= 2;
  }
  while (bpm > opts.maxBpm) {
    bpm /= 2;
  }

  const variance =
    intervals.reduce((sum, value) => sum + (value - avgInterval) ** 2, 0) /
    intervals.length;
  const confidence = Math.max(0, Math.min(1, 1 - variance * 10));

  return {
    bpm: Number(bpm.toFixed(2)),
    confidence
  };
}
