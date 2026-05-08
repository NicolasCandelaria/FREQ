import { estimateBpmFromOnsets } from "./bpm";
import { extractFrameFeatures } from "./features";
import { estimateKey } from "./key";
import { aggregateWindows } from "./windowing";
import type { AnalysisFrame, TimelineWindow } from "../types/timeline";

const BPM_CONFIDENCE_THRESHOLD = 0.35;
const KEY_CONFIDENCE_THRESHOLD = 0.55;

function getFramesForWindow(
  frames: readonly AnalysisFrame[],
  startSec: number,
  endSec: number
): AnalysisFrame[] {
  return frames.filter((frame) => frame.timeSec >= startSec && frame.timeSec < endSec);
}

function detectOnsetTimes(frames: readonly AnalysisFrame[]): number[] {
  if (frames.length < 2) {
    return [];
  }

  const meanRms = frames.reduce((sum, frame) => sum + frame.rms, 0) / frames.length;
  const threshold = Math.max(0.03, meanRms * 1.2);
  const onsetTimes: number[] = [];

  for (let index = 1; index < frames.length; index += 1) {
    const previous = frames[index - 1];
    const current = frames[index];
    if (previous.rms <= threshold && current.rms > threshold) {
      onsetTimes.push(current.timeSec);
    }
  }

  return onsetTimes;
}

function sumWindowChroma(frames: readonly AnalysisFrame[]): number[] {
  const chroma = new Array<number>(12).fill(0);
  for (const frame of frames) {
    for (let index = 0; index < 12; index += 1) {
      chroma[index] += frame.chroma[index] ?? 0;
    }
  }
  return chroma;
}

export async function runAnalysisPipeline(
  samples: Float32Array,
  sampleRate: number
): Promise<TimelineWindow[]> {
  const frames = extractFrameFeatures(samples, sampleRate);
  const durationSec = sampleRate > 0 ? samples.length / sampleRate : 0;
  const windows = aggregateWindows(frames, durationSec, 30);

  for (const window of windows) {
    const windowFrames = getFramesForWindow(frames, window.startSec, window.endSec);

    const bpmEstimate = estimateBpmFromOnsets(detectOnsetTimes(windowFrames), {
      minBpm: 70,
      maxBpm: 180
    });
    window.bpmConfidence = bpmEstimate.confidence;
    window.bpm =
      bpmEstimate.confidence >= BPM_CONFIDENCE_THRESHOLD ? bpmEstimate.bpm : null;

    const keyEstimate = estimateKey(sumWindowChroma(windowFrames));
    window.keyConfidence = keyEstimate.confidence;
    window.key =
      keyEstimate.confidence >= KEY_CONFIDENCE_THRESHOLD ? keyEstimate.key : null;
  }

  return windows;
}
