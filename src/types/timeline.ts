export interface AnalysisFrame {
  timeSec: number;
  rms: number;
  chroma: number[];
}

export interface TimelineWindow {
  startSec: number;
  endSec: number;
  energyRms: number;
  bpm: number | null;
  bpmConfidence: number;
  key: string | null;
  keyConfidence: number;
}
