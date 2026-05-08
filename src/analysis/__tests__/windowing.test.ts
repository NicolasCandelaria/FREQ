import { describe, expect, it } from "vitest";
import type { TimelineFrameSample } from "../../types/timeline";
import { aggregateTimelineWindows } from "../windowing";

describe("aggregateTimelineWindows", () => {
  it("aggregates frame samples into 30-second windows", () => {
    const frames: TimelineFrameSample[] = [
      {
        timeSec: 3,
        energyRms: 0.2,
        bpm: 120,
        bpmConfidence: 0.8,
        key: "Am",
        keyConfidence: 0.9
      },
      {
        timeSec: 12,
        energyRms: 0.4,
        bpm: 122,
        bpmConfidence: 0.7,
        key: "Am",
        keyConfidence: 0.7
      },
      {
        timeSec: 35,
        energyRms: 0.8,
        bpm: 128,
        bpmConfidence: 0.95,
        key: "C",
        keyConfidence: 0.8
      }
    ];

    const windows = aggregateTimelineWindows(frames);

    expect(windows).toHaveLength(2);
    expect(windows[0]).toMatchObject({
      startSec: 0,
      endSec: 30,
      bpm: 121,
      bpmConfidence: 0.75,
      key: "Am",
      keyConfidence: 1
    });
    expect(windows[0].energyRms).toBeCloseTo(0.3);
    expect(windows[1]).toMatchObject({
      startSec: 30,
      endSec: 60,
      energyRms: 0.8,
      bpm: 128,
      bpmConfidence: 0.95,
      key: "C",
      keyConfidence: 1
    });
  });

  it("nulls uncertain bpm and key values", () => {
    const frames: TimelineFrameSample[] = [
      {
        timeSec: 5,
        energyRms: 0.1,
        bpm: 110,
        bpmConfidence: 0.35,
        key: "Dm",
        keyConfidence: 0.45
      },
      {
        timeSec: 20,
        energyRms: 0.3,
        bpm: 112,
        bpmConfidence: 0.25,
        key: "F",
        keyConfidence: 0.35
      }
    ];

    const windows = aggregateTimelineWindows(frames);

    expect(windows).toHaveLength(1);
    expect(windows[0].energyRms).toBe(0.2);
    expect(windows[0].bpm).toBeNull();
    expect(windows[0].bpmConfidence).toBe(0.3);
    expect(windows[0].key).toBeNull();
    expect(windows[0].keyConfidence).toBe(0.5);
  });
});
