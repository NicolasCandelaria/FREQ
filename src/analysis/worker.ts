import { runAnalysisPipelineDirect } from "./workerClient";
import type { AnalysisWorkerRequest, AnalysisWorkerResponse } from "./workerClient";

const workerScope = self as unknown as {
  postMessage: (message: AnalysisWorkerResponse) => void;
};

self.onmessage = async (event: MessageEvent<AnalysisWorkerRequest>): Promise<void> => {
  try {
    const { requestId, samples, sampleRate } = event.data;
    const windows = await runAnalysisPipelineDirect(samples, sampleRate);
    workerScope.postMessage({
      type: "done",
      requestId,
      windows
    } satisfies AnalysisWorkerResponse);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown analysis error";
    const requestId = event.data?.requestId ?? "unknown";
    workerScope.postMessage({
      type: "error",
      requestId,
      message
    } satisfies AnalysisWorkerResponse);
  }
};
