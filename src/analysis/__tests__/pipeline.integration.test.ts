import { describe, expect, it } from "vitest";
import { runAnalysisPipeline } from "../workerClient";
import { makeTestSignal } from "../../fixtures/testSignals";

describe("analysis pipeline", () => {
  it("returns windows with energy, bpm, and key metrics", async () => {
    const signal = makeTestSignal(65, 44_100, {
      pulseBpm: 120,
      keyBiasIndex: 0
    });

    const result = await runAnalysisPipeline(signal, 44_100);

    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("energyRms");
    expect(result[0]).toHaveProperty("bpm");
    expect(result[0]).toHaveProperty("key");
  });

  it("maps low-confidence bpm and key estimates to null", async () => {
    const signal = new Float32Array(44_100 * 35);

    const result = await runAnalysisPipeline(signal, 44_100);

    expect(result).toHaveLength(2);
    for (const window of result) {
      expect(window.bpm).toBeNull();
      expect(window.key).toBeNull();
      expect(window.bpmConfidence).toBeLessThanOrEqual(0.3);
      expect(window.keyConfidence).toBeLessThanOrEqual(0.5);
    }
  });
});
