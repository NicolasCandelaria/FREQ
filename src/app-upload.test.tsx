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

describe("App upload flow", () => {
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    container?.remove();
    container = null;
    mocks.decodeToMonoMock.mockReset();
    mocks.runAnalysisPipelineMock.mockReset();
  });

  it("shows upload CTA and transitions decode -> analyze -> rendered", async () => {
    mocks.decodeToMonoMock.mockResolvedValue({
      samples: new Float32Array([0.1, 0.2, 0.3]),
      sampleRate: 44_100,
      durationSec: 1
    });
    mocks.runAnalysisPipelineMock.mockResolvedValue(analyzedWindows);

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

    expect(mocks.decodeToMonoMock).toHaveBeenCalledWith(file);
    expect(mocks.runAnalysisPipelineMock).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Status: Analysis complete");
    expect(container.textContent).toContain("1 windows analyzed");
  });
});
