import { afterEach, describe, expect, it, vi } from "vitest";
import { runAnalysisPipelineInWorker } from "../workerClient";
import type { TimelineWindow } from "../../types/timeline";

type Handler = (event: MessageEvent<unknown>) => void;

class MockWorker {
  static instances: MockWorker[] = [];
  public onmessage: Handler | null = null;
  public onerror: ((event: ErrorEvent) => void) | null = null;
  public readonly postMessage = vi.fn();
  public readonly terminate = vi.fn();

  constructor() {
    MockWorker.instances.push(this);
  }
}

describe("worker client protocol", () => {
  afterEach(() => {
    MockWorker.instances = [];
    vi.unstubAllGlobals();
  });

  it("resolves windows on done response", async () => {
    vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);
    const promise = runAnalysisPipelineInWorker(new Float32Array(1024), 44_100);
    const instance = MockWorker.instances[0];
    const request = instance.postMessage.mock.calls[0][0] as { requestId: string };
    const payload: TimelineWindow[] = [
      {
        startSec: 0,
        endSec: 30,
        energyRms: 0.4,
        bpm: 120,
        bpmConfidence: 0.8,
        key: "C major",
        keyConfidence: 0.7
      }
    ];

    instance.onmessage?.(
      new MessageEvent("message", {
        data: { type: "done", requestId: request.requestId, windows: payload }
      })
    );

    const result = await promise;
    expect(result).toEqual(payload);
    expect(instance.postMessage).toHaveBeenCalledTimes(1);
    expect(instance.terminate).toHaveBeenCalledTimes(1);
  });

  it("rejects when worker responds with error", async () => {
    vi.stubGlobal("Worker", MockWorker as unknown as typeof Worker);
    const promise = runAnalysisPipelineInWorker(new Float32Array(2048), 44_100);
    const instance = MockWorker.instances[0];
    const request = instance.postMessage.mock.calls[0][0] as { requestId: string };

    instance.onmessage?.(
      new MessageEvent("message", {
        data: {
          type: "error",
          requestId: request.requestId,
          message: "bad analysis input"
        }
      })
    );

    await expect(promise).rejects.toThrow("bad analysis input");
    expect(instance.postMessage).toHaveBeenCalledTimes(1);
    expect(instance.terminate).toHaveBeenCalledTimes(1);
  });
});
