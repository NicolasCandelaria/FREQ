import { useEffect, useRef, useState } from "react";
import { runAnalysisPipeline } from "./analysis/workerClient";
import { decodeToMono } from "./audio/decode";
import { getWindowIndexAtX, renderTimeline } from "./render/timelineCanvas";
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
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const activeRequestRef = useRef(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!canvasRef.current) {
      return;
    }
    renderTimeline(canvasRef.current, windows, { hoverIndex });
  }, [windows, hoverIndex]);

  async function handleFile(file: File): Promise<void> {
    const requestId = activeRequestRef.current + 1;
    activeRequestRef.current = requestId;

    if (!isSupportedAudioFile(file)) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setHoverIndex(null);
      setWindows([]);
      setStatus("error");
      setErrorMessage("Please upload one .mp3, .wav, or .m4a file.");
      return;
    }

    setWindows([]);
    setHoverIndex(null);
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
      setHoverIndex(null);
      setWindows([]);
      setStatus("error");
      setErrorMessage("We could not decode or analyze that track. Please try another file.");
    }
  }

  const hoveredWindow =
    hoverIndex !== null && windows[hoverIndex] ? windows[hoverIndex] : null;

  const bpmConfidenceClass =
    hoveredWindow && hoveredWindow.bpmConfidence < 0.5 ? "low-confidence" : "high-confidence";
  const keyConfidenceClass =
    hoveredWindow && hoveredWindow.keyConfidence < 0.5 ? "low-confidence" : "high-confidence";

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
          <div className="timeline-shell">
            <p>{windows.length} windows analyzed</p>
            <canvas
              ref={canvasRef}
              width={1200}
              height={420}
              onMouseMove={(event) => {
                const rect = event.currentTarget.getBoundingClientRect();
                const x = event.clientX - rect.left;
                setHoverIndex(getWindowIndexAtX(x, event.currentTarget.width, windows.length));
              }}
              onMouseLeave={() => {
                setHoverIndex(null);
              }}
            />
            {hoveredWindow ? (
              <div className="timeline-tooltip" role="status" aria-live="polite">
                <p>
                  <strong>Window:</strong> {hoveredWindow.startSec.toFixed(0)}s -{" "}
                  {hoveredWindow.endSec.toFixed(0)}s
                </p>
                <p>
                  <strong>Energy:</strong> {hoveredWindow.energyRms.toFixed(3)}
                </p>
                <p className={bpmConfidenceClass}>
                  <strong>BPM:</strong>{" "}
                  {hoveredWindow.bpm === null ? "N/A" : hoveredWindow.bpm.toFixed(1)} (
                  {(hoveredWindow.bpmConfidence * 100).toFixed(0)}% confidence)
                </p>
                <p className={keyConfidenceClass}>
                  <strong>Key:</strong> {hoveredWindow.key ?? "Unknown"} (
                  {(hoveredWindow.keyConfidence * 100).toFixed(0)}% confidence)
                </p>
              </div>
            ) : (
              <p className="timeline-hint">Hover the timeline to inspect a window</p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
