import { describe, expect, it } from "vitest";
import { runAnalysisPipelineDirect } from "../workerClient";
import { makeTestSignal } from "../../fixtures/testSignals";

describe("analysis pipeline", () => {
  it("returns windows with energy, bpm, and key metrics", async () => {
    const signal = makeTestSignal(65, 44_100, {
      pulseBpm: 120,
      keyBiasIndex: 0
    });

    const result = await runAnalysisPipelineDirect(signal, 44_100);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("energyRms");
    expect(result[0]).toHaveProperty("bpm");
    expect(result[0]).toHaveProperty("key");
    for (const window of result) {
      expect(window.bpmConfidence).toBeGreaterThanOrEqual(0);
      expect(window.bpmConfidence).toBeLessThanOrEqual(1);
      expect(window.keyConfidence).toBeGreaterThanOrEqual(0);
      expect(window.keyConfidence).toBeLessThanOrEqual(1);
    }
    expect(result.some((window) => window.bpm !== null)).toBe(true);
    expect(result.some((window) => window.key !== null)).toBe(true);
  });

  it("maps low-confidence bpm and key estimates to null", async () => {
    const signal = new Float32Array(44_100 * 35);

    const result = await runAnalysisPipelineDirect(signal, 44_100);

    expect(result).toHaveLength(2);
    for (const window of result) {
      expect(window.bpm).toBeNull();
      expect(window.key).toBeNull();
      expect(window.bpmConfidence).toBeLessThanOrEqual(0.3);
      expect(window.keyConfidence).toBeLessThanOrEqual(0.5);
    }
  });
});
