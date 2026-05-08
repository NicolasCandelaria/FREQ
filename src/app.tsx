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
  const [hoverX, setHoverX] = useState(0);
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
      setHoverX(0);
      setWindows([]);
      setStatus("error");
      setErrorMessage("Please upload one .mp3, .wav, or .m4a file.");
      return;
    }

    setWindows([]);
    setHoverIndex(null);
    setHoverX(0);
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
      setHoverIndex(null);
      setHoverX(0);
      setStatus("rendered");
    } catch (_error) {
      if (activeRequestRef.current !== requestId) {
        return;
      }
      setHoverIndex(null);
      setHoverX(0);
      setWindows([]);
      setStatus("error");
      setErrorMessage("We could not decode or analyze that track. Please try another file.");
    }
  }

  const hoveredWindow =
    hoverIndex !== null && windows[hoverIndex] ? windows[hoverIndex] : null;
  const tooltipLeftPercent = (hoverX / 1200) * 100;

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
                const canvas = event.currentTarget;
                const rect = canvas.getBoundingClientRect();
                const scaleX = canvas.width / rect.width;
                const x = (event.clientX - rect.left) * scaleX;
                setHoverX(Math.max(0, Math.min(canvas.width, x)));
                setHoverIndex(getWindowIndexAtX(x, canvas.width, windows.length));
              }}
              onMouseLeave={() => {
                setHoverIndex(null);
              }}
            />
            {hoveredWindow ? (
              <div
                className="timeline-tooltip"
                role="status"
                aria-live="polite"
                style={{ left: `${tooltipLeftPercent}%` }}
              >
                <p className="timeline-tooltip__range">
                  {hoveredWindow.startSec.toFixed(0)}s - {hoveredWindow.endSec.toFixed(0)}s
                </p>
                <p>
                  <strong>Energy:</strong> {hoveredWindow.energyRms.toFixed(2)}
                </p>
                <p>
                  <strong>BPM:</strong>{" "}
                  {hoveredWindow.bpm === null ? "Unknown" : hoveredWindow.bpm.toFixed(0)}
                  <span
                    className={`confidence-pill ${
                      hoveredWindow.bpmConfidence >= 0.75
                        ? "confidence-pill--high"
                        : hoveredWindow.bpmConfidence >= 0.45
                          ? "confidence-pill--medium"
                          : "confidence-pill--low"
                    }`}
                  >
                    {Math.round(hoveredWindow.bpmConfidence * 100)}%
                  </span>
                </p>
                <p>
                  <strong>Key:</strong> {hoveredWindow.key ?? "Unknown"}
                  <span
                    className={`confidence-pill ${
                      hoveredWindow.keyConfidence >= 0.75
                        ? "confidence-pill--high"
                        : hoveredWindow.keyConfidence >= 0.45
                          ? "confidence-pill--medium"
                          : "confidence-pill--low"
                    }`}
                  >
                    {Math.round(hoveredWindow.keyConfidence * 100)}%
                  </span>
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
