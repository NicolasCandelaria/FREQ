import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "./app";
import type { TimelineWindow } from "./types/timeline";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  decodeToMonoMock: vi.fn(),
  runAnalysisPipelineMock: vi.fn()
}));

vi.mock("./audio/decode", () => ({
  decodeToMono: mocks.decodeToMonoMock
}));

vi.mock("./analysis/workerClient", () => ({
  runAnalysisPipeline: mocks.runAnalysisPipelineMock
}));

const analyzedWindows: TimelineWindow[] = [
  {
    startSec: 0,
    endSec: 30,
    energyRms: 0.72,
    bpm: 124,
    bpmConfidence: 0.81,
    key: "Am",
    keyConfidence: 0.67,
    chroma: new Array<number>(12).fill(0)
  }
];

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

describe("App upload flow", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
    mocks.decodeToMonoMock.mockReset();
    mocks.runAnalysisPipelineMock.mockReset();
  });

  it("shows upload CTA and transitions decoding -> analyzing -> rendered", async () => {
    const decodeGate = deferred<{
      samples: Float32Array;
      sampleRate: number;
      durationSec: number;
    }>();
    const analyzeGate = deferred<TimelineWindow[]>();

    mocks.decodeToMonoMock.mockReturnValue(decodeGate.promise);
    mocks.runAnalysisPipelineMock.mockReturnValue(analyzeGate.promise);

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    expect(container.textContent).toContain("Drop audio file to analyze timeline");
    expect(container.textContent).toContain("Status: Ready for upload");

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["fake"], "demo.mp3", { type: "audio/mpeg" });

    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file]
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Status: Decoding audio file...");

    await act(async () => {
      decodeGate.resolve({
        samples: new Float32Array([0.1, 0.2, 0.3]),
        sampleRate: 44_100,
        durationSec: 1
      });
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Status: Analyzing track in worker...");

    await act(async () => {
      analyzeGate.resolve(analyzedWindows);
      await Promise.resolve();
    });

    expect(mocks.decodeToMonoMock).toHaveBeenCalledWith(file);
    expect(mocks.runAnalysisPipelineMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Status: Analysis complete");
    expect(container.textContent).toContain("1 windows analyzed");
  });

  it("shows error state when decoding fails", async () => {
    mocks.decodeToMonoMock.mockRejectedValue(new Error("decode failed"));

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["fake"], "demo.mp3", { type: "audio/mpeg" });

    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file]
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Status: Unable to process audio");
    expect(container.textContent).toContain(
      "We could not decode or analyze that track. Please try another file."
    );
  });

  it("keeps latest upload result when earlier request resolves last", async () => {
    const firstAnalyze = deferred<TimelineWindow[]>();
    const secondAnalyze = deferred<TimelineWindow[]>();

    mocks.decodeToMonoMock
      .mockResolvedValueOnce({
        samples: new Float32Array([0.1, 0.1, 0.1]),
        sampleRate: 44_100,
        durationSec: 1
      })
      .mockResolvedValueOnce({
        samples: new Float32Array([0.2, 0.2, 0.2]),
        sampleRate: 44_100,
        durationSec: 1
      });
    mocks.runAnalysisPipelineMock
      .mockReturnValueOnce(firstAnalyze.promise)
      .mockReturnValueOnce(secondAnalyze.promise);

    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(<App />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const firstFile = new File(["one"], "first.mp3", { type: "audio/mpeg" });
    const secondFile = new File(["two"], "second.mp3", { type: "audio/mpeg" });

    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [firstFile] });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      Object.defineProperty(input, "files", { configurable: true, value: [secondFile] });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    await act(async () => {
      secondAnalyze.resolve(analyzedWindows);
      await Promise.resolve();
    });
    expect(container.textContent).toContain("Status: Analysis complete");
    expect(container.textContent).toContain("1 windows analyzed");

    await act(async () => {
      firstAnalyze.resolve([]);
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Status: Analysis complete");
    expect(container.textContent).toContain("1 windows analyzed");
  });
});
