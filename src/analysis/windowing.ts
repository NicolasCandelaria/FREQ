import type {
  TimelineFrameSample,
  TimelineWindow,
  WindowAggregationOptions
} from "../types/timeline";

const DEFAULT_WINDOW_SIZE_SEC = 30;
const DEFAULT_MIN_BPM_CONFIDENCE = 0.6;
const DEFAULT_MIN_KEY_CONFIDENCE = 0.6;

interface MutableWindowStats {
  index: number;
  energySum: number;
  bpmSum: number;
  bpmConfidenceSum: number;
  bpmCount: number;
  keyVotes: Map<string, number>;
  keyCount: number;
  sampleCount: number;
}

function average(sum: number, count: number): number {
  return count === 0 ? 0 : sum / count;
}

export function aggregateTimelineWindows(
  frames: readonly TimelineFrameSample[],
  options: WindowAggregationOptions = {}
): TimelineWindow[] {
  if (frames.length === 0) {
    return [];
  }

  const windowSizeSec = options.windowSizeSec ?? DEFAULT_WINDOW_SIZE_SEC;
  const minBpmConfidence =
    options.minBpmConfidence ?? DEFAULT_MIN_BPM_CONFIDENCE;
  const minKeyConfidence =
    options.minKeyConfidence ?? DEFAULT_MIN_KEY_CONFIDENCE;

  const statsByWindow = new Map<number, MutableWindowStats>();

  for (const frame of frames) {
    const index = Math.floor(frame.timeSec / windowSizeSec);
    const stats = statsByWindow.get(index) ?? {
      index,
      energySum: 0,
      bpmSum: 0,
      bpmConfidenceSum: 0,
      bpmCount: 0,
      keyVotes: new Map<string, number>(),
      keyCount: 0,
      sampleCount: 0
    };

    stats.energySum += frame.energyRms;
    stats.sampleCount += 1;

    if (frame.bpm !== null) {
      stats.bpmSum += frame.bpm;
      stats.bpmConfidenceSum += frame.bpmConfidence;
      stats.bpmCount += 1;
    }

    if (frame.key !== null) {
      const existingVotes = stats.keyVotes.get(frame.key) ?? 0;
      stats.keyVotes.set(frame.key, existingVotes + 1);
      stats.keyCount += 1;
    }

    statsByWindow.set(index, stats);
  }

  const sortedStats = [...statsByWindow.values()].sort(
    (left, right) => left.index - right.index
  );

  return sortedStats.map((stats) => {
    const startSec = stats.index * windowSizeSec;
    const endSec = startSec + windowSizeSec;
    const energyRms = average(stats.energySum, stats.sampleCount);
    const bpmConfidence = average(stats.bpmConfidenceSum, stats.bpmCount);
    const bpmAverage = average(stats.bpmSum, stats.bpmCount);
    const bpm = bpmConfidence >= minBpmConfidence ? bpmAverage : null;

    let topKey: string | null = null;
    let topVotes = 0;
    for (const [key, votes] of stats.keyVotes.entries()) {
      if (votes > topVotes) {
        topKey = key;
        topVotes = votes;
      }
    }

    const keyConfidence = average(topVotes, stats.keyCount);
    const key = keyConfidence >= minKeyConfidence ? topKey : null;

    return {
      startSec,
      endSec,
      energyRms,
      bpm,
      bpmConfidence,
      key,
      keyConfidence
    };
  });
}
