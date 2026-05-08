import { runAnalysisPipelineDirect } from "./workerClient";
import type { TimelineWindow } from "../types/timeline";
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from "./workerClient";

self.onmessage = async (event: MessageEvent<AnalysisWorkerRequest>): Promise<void> => {
  try {
    const { requestId, samples, sampleRate } = event.data;
    const windows = await runAnalysisPipelineDirect(samples, sampleRate);
    (self as DedicatedWorkerGlobalScope).postMessage({
      type: "done",
      requestId,
      windows
    } satisfies AnalysisWorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis error";
    const requestId = event.data?.requestId ?? "unknown";
    (self as DedicatedWorkerGlobalScope).postMessage({
      type: "error",
      requestId,
      message
    } satisfies AnalysisWorkerResponse);
  }
};
