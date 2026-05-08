export interface TimelineWindow {
  startSec: number;
  endSec: number;
  energyRms: number;
  bpm: number | null;
  bpmConfidence: number;
  key: string | null;
  keyConfidence: number;
}

export interface TimelineFrameSample {
  timeSec: number;
  energyRms: number;
  bpm: number | null;
  bpmConfidence: number;
  key: string | null;
  keyConfidence: number;
}

export interface WindowAggregationOptions {
  windowSizeSec?: number;
  minBpmConfidence?: number;
  minKeyConfidence?: number;
}
