import type { AnalysisFrame, TimelineWindow } from "../types/timeline";

function average(sum: number, count: number): number {
  return count === 0 ? 0 : sum / count;
}

export function aggregateWindows(
  frames: readonly AnalysisFrame[],
  durationSec: number,
  windowSec = 30
): TimelineWindow[] {
  if (windowSec <= 0) {
    throw new Error("windowSec must be greater than 0");
  }

  const safeDurationSec = Math.max(0, durationSec);
  const totalWindows = Math.ceil(safeDurationSec / windowSec);
  const energySumByWindow = new Array<number>(totalWindows).fill(0);
  const frameCountByWindow = new Array<number>(totalWindows).fill(0);

  for (const frame of frames) {
    const index = Math.floor(frame.timeSec / windowSec);
    if (index < 0 || index >= totalWindows) {
      continue;
    }
    energySumByWindow[index] += frame.rms;
    frameCountByWindow[index] += 1;
  }

  const windows: TimelineWindow[] = [];
  for (let index = 0; index < totalWindows; index += 1) {
    const startSec = index * windowSec;
    windows.push({
      startSec,
      endSec: startSec + windowSec,
      energyRms: average(energySumByWindow[index], frameCountByWindow[index]),
      bpm: null,
      bpmConfidence: 0,
      key: null,
      keyConfidence: 0
    });
  }

  return windows;
}
