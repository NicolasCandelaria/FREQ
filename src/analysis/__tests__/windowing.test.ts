import { describe, expect, it } from "vitest";
import type { AnalysisFrame } from "../../types/timeline";
import { aggregateWindows } from "../windowing";

describe("aggregateWindows", () => {
  it("aggregates rms frames using default 30-second windows", () => {
    const frames: AnalysisFrame[] = [
      {
        timeSec: 3,
        rms: 0.2,
        chroma: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      },
      {
        timeSec: 12,
        rms: 0.4,
        chroma: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      },
      {
        timeSec: 35,
        rms: 0.8,
        chroma: [0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    ];

    const windows = aggregateWindows(frames, 60);

    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({
      startSec: 0,
      endSec: 30,
      bpm: null,
      bpmConfidence: 0,
      key: null,
      keyConfidence: 0
    });
    expect(windows[0].energyRms).toBeCloseTo(0.3);
    expect(windows[1]).toMatchObject({
      startSec: 30,
      endSec: 60,
      energyRms: 0.8,
      bpm: null,
      bpmConfidence: 0,
      key: null,
      keyConfidence: 0
    });
  });

  it("creates full duration-driven windows including empty buckets", () => {
    const frames: AnalysisFrame[] = [
      {
        timeSec: 5,
        rms: 0.1,
        chroma: [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      },
      {
        timeSec: 65,
        rms: 0.7,
        chroma: [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
      }
    ];

    const windows = aggregateWindows(frames, 70);

    expect(windows).toHaveLength(3);
    expect(windows[0]).toMatchObject({ startSec: 0, endSec: 30, energyRms: 0.1 });
    expect(windows[1]).toMatchObject({ startSec: 30, endSec: 60, energyRms: 0 });
    expect(windows[2]).toMatchObject({ startSec: 60, endSec: 90, energyRms: 0.7 });
  });
});
