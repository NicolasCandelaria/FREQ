import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import App from "./app";
import { createFakeAudioBuffer } from "./test/fakeAudioBuffer";
import type { TimelineWindow } from "./types/timeline";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

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
    keyConfidence: 0.67
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
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

  beforeAll(() => {
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    const stubContext = {
      fillStyle: "#000000",
      strokeStyle: "#000000",
      lineWidth: 1,
      lineCap: "round",
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: vi.fn()
    } as unknown as CanvasRenderingContext2D;
    HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(stubContext);
  });

  afterEach(() => {
    container?.remove();
    container = null;
    mocks.decodeToMonoMock.mockReset();
    mocks.runAnalysisPipelineMock.mockReset();
  });

  afterAll(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
  });

  it("shows upload CTA and transitions decoding -> analyzing -> rendered", async () => {
    const decodeGate = deferred<{
      samples: Float32Array;
      sampleRate: number;
      durationSec: number;
      audioBuffer: AudioBuffer;
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

    expect(container.textContent).toContain("Select audio file to analyze timeline");
    expect(container.textContent).toContain("Status: Ready for upload");
    expect(container.textContent).toContain("No file chosen");

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

    expect(container.textContent).toContain("demo.mp3");
    expect(container.textContent).toContain("Status: Decoding audio file...");

    await act(async () => {
      decodeGate.resolve({
        samples: new Float32Array([0.1, 0.2, 0.3]),
        sampleRate: 44_100,
        durationSec: 1,
        audioBuffer: createFakeAudioBuffer()
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

  it("shows error state when analysis returns zero windows", async () => {
    mocks.decodeToMonoMock.mockResolvedValue({
      samples: new Float32Array([0.1, 0.2, 0.3]),
      sampleRate: 44_100,
      durationSec: 1,
      audioBuffer: createFakeAudioBuffer()
    });
    mocks.runAnalysisPipelineMock.mockResolvedValue([]);

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
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Status: Unable to process audio");
    expect(container.textContent).toContain(
      "Analysis finished but produced no timeline windows for this track. It may be too short or unreadable."
    );
    expect(container.textContent).toContain("Select audio file to analyze timeline");
  });

  it("shows error state for unsupported file types", async () => {
    container = document.createElement("div");
    document.body.append(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<App />);
    });

    const input = container.querySelector("input[type='file']") as HTMLInputElement;
    const file = new File(["x"], "readme.txt", { type: "text/plain" });

    await act(async () => {
      Object.defineProperty(input, "files", {
        configurable: true,
        value: [file]
      });
      input.dispatchEvent(new Event("change", { bubbles: true }));
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Status: Unable to process audio");
    expect(container.textContent).toContain("Please upload one .mp3, .wav, or .m4a file.");
    expect(mocks.decodeToMonoMock).not.toHaveBeenCalled();
    expect(mocks.runAnalysisPipelineMock).not.toHaveBeenCalled();
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
        durationSec: 1,
        audioBuffer: createFakeAudioBuffer()
      })
      .mockResolvedValueOnce({
        samples: new Float32Array([0.2, 0.2, 0.2]),
        sampleRate: 44_100,
        durationSec: 1,
        audioBuffer: createFakeAudioBuffer()
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
