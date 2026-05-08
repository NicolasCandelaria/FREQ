import { runAnalysisPipeline } from "./workerClient";
import type { TimelineWindow } from "../types/timeline";

type AnalysisWorkerRequest = {
  samples: Float32Array;
  sampleRate: number;
};

type AnalysisWorkerResponse =
  | { type: "done"; windows: TimelineWindow[] }
  | { type: "error"; message: string };

self.onmessage = async (event: MessageEvent<AnalysisWorkerRequest>): Promise<void> => {
  try {
    const { samples, sampleRate } = event.data;
    const windows = await runAnalysisPipeline(samples, sampleRate);
    (self as DedicatedWorkerGlobalScope).postMessage({
      type: "done",
      windows
    } satisfies AnalysisWorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis error";
    (self as DedicatedWorkerGlobalScope).postMessage({
      type: "error",
      message
    } satisfies AnalysisWorkerResponse);
  }
};
