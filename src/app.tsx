import { useEffect, useRef, useState } from "react";
import { runAnalysisPipeline } from "./analysis/workerClient";
import { decodeToMono } from "./audio/decode";
import { renderTimeline } from "./render/timelineCanvas";
import type { TimelineWindow } from "./types/timeline";

type UploadStatus = "idle" | "decoding" | "analyzing" | "rendered" | "error";

const SUPPORTED_EXTENSIONS = [".mp3", ".wav", ".m4a"];
const SUPPORTED_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/x-wav",
  "audio/wave",
  "audio/x-pn-wav",
  "audio/mp4",
  "audio/x-m4a"
];

function getStatusMessage(status: UploadStatus): string {
  switch (status) {
    case "idle":
      return "Ready for upload";
    case "decoding":
      return "Decoding audio file...";
    case "analyzing":
      return "Analyzing track in worker...";
    case "rendered":
      return "Analysis complete";
    case "error":
      return "Unable to process audio";
    default:
      return "Ready for upload";
  }
}

function isSupportedAudioFile(file: File): boolean {
  const lowerName = file.name.toLowerCase();
  const hasSupportedExtension = SUPPORTED_EXTENSIONS.some((extension) =>
    lowerName.endsWith(extension)
  );
  const lowerType = file.type.toLowerCase();
  const hasSupportedMimeType = SUPPORTED_MIME_TYPES.includes(lowerType);
  return hasSupportedExtension || hasSupportedMimeType;
}

export default function App() {
  const [status, setStatus] = useState<UploadStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [windows, setWindows] = useState<TimelineWindow[]>([]);
  const activeRequestRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    renderTimeline(canvasRef.current, windows);
  }, [windows]);

  async function handleFile(file: File): Promise<void> {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    if (!isSupportedAudioFile(file)) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setWindows([]);
      setStatus("error");
      setErrorMessage("Please upload one .mp3, .wav, or .m4a file.");
      return;
    }

    setWindows([]);
    setErrorMessage(null);
    setStatus("decoding");

    try {
      const decoded = await decodeToMono(file);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setStatus("analyzing");
      const analyzedWindows = await runAnalysisPipeline(decoded.samples, decoded.sampleRate);
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setWindows(analyzedWindows);
      setStatus("rendered");
    } catch (_error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setWindows([]);
      setStatus("error");
      setErrorMessage("We could not decode or analyze that track. Please try another file.");
    }
  }

  return (
    <main className="app">
      <section>
        <h1>DJ Music Visualizer</h1>
        <p>Status: {getStatusMessage(status)}</p>
        <p>Supported format: one file (.mp3, .wav, .m4a)</p>
        <input
          type="file"
          accept={[...SUPPORTED_EXTENSIONS, ...SUPPORTED_MIME_TYPES].join(",")}
          onChange={(event) => {
            const selectedFile = event.currentTarget.files?.[0];
            if (selectedFile) {
              void handleFile(selectedFile);
            }
            event.currentTarget.value = "";
          }}
        />
        {errorMessage ? <p role="alert">{errorMessage}</p> : null}
        {windows.length === 0 ? (
          <p>Drop audio file to analyze timeline</p>
        ) : (
          <>
            <p>{windows.length} windows analyzed</p>
            <canvas ref={canvasRef} width={1200} height={420} />
          </>
        )}
      </section>
    </main>
  );
}
