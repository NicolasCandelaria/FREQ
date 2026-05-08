import { useCallback, useEffect, useRef, useState } from "react";
import { drawCircularSpectrum } from "../render/circularSpectrum";

const FFT_SIZE = 512;
const BAR_COUNT = 72;

type Props = {
  audioBuffer: AudioBuffer | null;
};

export function CircularPlayback({ audioBuffer }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(FFT_SIZE / 2)));
  const animationRef = useRef<number>(0);

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = 0;
  }, []);

  const teardownGraph = useCallback(async () => {
    stopAnimation();
    try {
      sourceRef.current?.stop();
    } catch {
      /* already stopped */
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current?.disconnect();
    analyserRef.current = null;
    if (audioContextRef.current) {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [stopAnimation]);

  const drawFrame = useCallback(() => {
    const canvas = canvasRef.current;
    const analyser = analyserRef.current;
    if (!canvas || !analyser) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    if (frequencyDataRef.current.length !== analyser.frequencyBinCount) {
      frequencyDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) as Uint8Array<ArrayBuffer>;
    }
    analyser.getByteFrequencyData(frequencyDataRef.current);
    drawCircularSpectrum(ctx, frequencyDataRef.current, canvas.width, canvas.height, BAR_COUNT);
    animationRef.current = requestAnimationFrame(drawFrame);
  }, []);

  const startPlayback = useCallback(async () => {
    if (!audioBuffer) {
      return;
    }
    await teardownGraph();

    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    await audioCtx.resume();

    const source = audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0.82;
    analyser.minDecibels = -85;
    analyser.maxDecibels = -10;

    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    sourceRef.current = source;
    analyserRef.current = analyser;
    frequencyDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) as Uint8Array<ArrayBuffer>;

    source.onended = () => {
      stopAnimation();
      setIsPlaying(false);
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (canvas && ctx) {
        drawCircularSpectrum(
          ctx,
          new Uint8Array(new ArrayBuffer(FFT_SIZE / 2)),
          canvas.width,
          canvas.height,
          BAR_COUNT
        );
      }
      void teardownGraph();
    };

    source.start(0);
    setIsPlaying(true);
    animationRef.current = requestAnimationFrame(drawFrame);
  }, [audioBuffer, drawFrame, stopAnimation, teardownGraph]);

  const pausePlayback = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (ctx?.state === "running") {
      await ctx.suspend();
      stopAnimation();
      setIsPlaying(false);
    }
  }, [stopAnimation]);

  const resumePlayback = useCallback(async () => {
    const ctx = audioContextRef.current;
    if (ctx?.state === "suspended") {
      await ctx.resume();
      setIsPlaying(true);
      animationRef.current = requestAnimationFrame(drawFrame);
    }
  }, [drawFrame]);

  const handleToggle = useCallback(async () => {
    if (!audioBuffer) {
      return;
    }
    const ctx = audioContextRef.current;

    if (ctx?.state === "suspended" && sourceRef.current) {
      await resumePlayback();
      return;
    }

    if (ctx?.state === "running") {
      await pausePlayback();
      return;
    }

    await startPlayback();
  }, [audioBuffer, pausePlayback, resumePlayback, startPlayback]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !audioBuffer) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const silent = new Uint8Array(new ArrayBuffer(FFT_SIZE / 2));
    drawCircularSpectrum(ctx, silent, canvas.width, canvas.height, BAR_COUNT);
  }, [audioBuffer]);

  useEffect(() => {
    return () => {
      stopAnimation();
      void teardownGraph();
    };
  }, [audioBuffer, stopAnimation, teardownGraph]);

  if (!audioBuffer) {
    return null;
  }

  return (
    <div className="circular-playback">
      <h2 className="circular-playback__title">Live spectrum</h2>
      <p className="circular-playback__hint">
        Bars bounce with frequency energy while the track plays. Play/Pause uses Web Audio (click may be required on
        first play).
      </p>
      <canvas
        ref={canvasRef}
        className="circular-playback__canvas"
        width={420}
        height={420}
        aria-label="Circular frequency spectrum visualization"
      />
      <div className="circular-playback__controls">
        <button type="button" className="circular-playback__button" onClick={() => void handleToggle()}>
          {isPlaying ? "Pause" : "Play"}
        </button>
        <span className="circular-playback__duration">{audioBuffer.duration.toFixed(1)}s track</span>
      </div>
    </div>
  );
}
