import { useCallback, useEffect, useRef, useState } from "react";
import { drawCircularSpectrum } from "../render/circularSpectrum";

const FFT_SIZE = 512;
const BAR_COUNT = 72;

export type PlaybackUpdatePayload = {
  headSec: number;
  durationSec: number;
  isPlaying: boolean;
  /** True once the user has started playback at least once (timeline reveal begins). */
  hasEverStarted: boolean;
};

type Props = {
  audioBuffer: AudioBuffer | null;
  /** Fires during playback (rAF) and on pause/resume/end so the timeline can sync to the playhead. */
  onPlaybackUpdate?: (payload: PlaybackUpdatePayload) => void;
};

export function CircularPlayback({ audioBuffer, onPlaybackUpdate }: Props) {
  const [isPlaying, setIsPlaying] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const frequencyDataRef = useRef<Uint8Array<ArrayBuffer>>(new Uint8Array(new ArrayBuffer(FFT_SIZE / 2)));
  const animationRef = useRef<number>(0);
  /** Playhead: at context time `t0`, the track position was `h0` seconds. */
  const playheadAnchorRef = useRef<{ t0: number; h0: number }>({ t0: 0, h0: 0 });
  /** When suspended, context clock keeps moving — freeze numeric head here. */
  const frozenHeadSecRef = useRef<number | null>(null);
  const hasEverStartedRef = useRef(false);

  const emitPlayback = useCallback(
    (headSec: number, durationSec: number, isPlaying: boolean) => {
      onPlaybackUpdate?.({
        headSec,
        durationSec,
        isPlaying,
        hasEverStarted: hasEverStartedRef.current
      });
    },
    [onPlaybackUpdate]
  );

  const getPlayheadSec = useCallback((ctx: AudioContext, durationSec: number): number => {
    if (frozenHeadSecRef.current !== null) {
      return frozenHeadSecRef.current;
    }
    const { t0, h0 } = playheadAnchorRef.current;
    return Math.min(durationSec, Math.max(0, ctx.currentTime - t0 + h0));
  }, []);

  const stopAnimation = useCallback(() => {
    cancelAnimationFrame(animationRef.current);
    animationRef.current = 0;
  }, []);

  const teardownGraph = useCallback(async () => {
    stopAnimation();
    frozenHeadSecRef.current = null;
    playheadAnchorRef.current = { t0: 0, h0: 0 };
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
    const audioCtx = audioContextRef.current;
    const buffer = audioBuffer;
    if (!canvas || !analyser || !audioCtx || !buffer) {
      return;
    }
    const ctx2d = canvas.getContext("2d");
    if (!ctx2d) {
      return;
    }
    if (frequencyDataRef.current.length !== analyser.frequencyBinCount) {
      frequencyDataRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount)) as Uint8Array<ArrayBuffer>;
    }
    analyser.getByteFrequencyData(frequencyDataRef.current);
    drawCircularSpectrum(ctx2d, frequencyDataRef.current, canvas.width, canvas.height, BAR_COUNT);

    const head = getPlayheadSec(audioCtx, buffer.duration);
    emitPlayback(head, buffer.duration, audioCtx.state === "running");

    animationRef.current = requestAnimationFrame(drawFrame);
  }, [audioBuffer, emitPlayback, getPlayheadSec]);

  const startPlayback = useCallback(async () => {
    if (!audioBuffer) {
      return;
    }
    await teardownGraph();

    const audioCtx = new AudioContext();
    audioContextRef.current = audioCtx;
    await audioCtx.resume();

    frozenHeadSecRef.current = null;
    playheadAnchorRef.current = { t0: audioCtx.currentTime, h0: 0 };
    hasEverStartedRef.current = true;
    emitPlayback(0, audioBuffer.duration, true);

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
      emitPlayback(audioBuffer.duration, audioBuffer.duration, false);
      void teardownGraph();
    };

    source.start(0);
    setIsPlaying(true);
    animationRef.current = requestAnimationFrame(drawFrame);
  }, [audioBuffer, drawFrame, emitPlayback, stopAnimation, teardownGraph]);

  const pausePlayback = useCallback(async () => {
    const ctx = audioContextRef.current;
    const buffer = audioBuffer;
    if (ctx?.state === "running" && buffer) {
      const { t0, h0 } = playheadAnchorRef.current;
      const head = Math.min(buffer.duration, Math.max(0, ctx.currentTime - t0 + h0));
      frozenHeadSecRef.current = head;
      await ctx.suspend();
      stopAnimation();
      setIsPlaying(false);
      emitPlayback(head, buffer.duration, false);
    }
  }, [audioBuffer, emitPlayback, stopAnimation]);

  const resumePlayback = useCallback(async () => {
    const ctx = audioContextRef.current;
    const buffer = audioBuffer;
    if (ctx?.state === "suspended" && buffer && frozenHeadSecRef.current !== null) {
      const h = frozenHeadSecRef.current;
      frozenHeadSecRef.current = null;
      playheadAnchorRef.current = { t0: ctx.currentTime, h0: h };
      await ctx.resume();
      setIsPlaying(true);
      emitPlayback(h, buffer.duration, true);
      animationRef.current = requestAnimationFrame(drawFrame);
    }
  }, [audioBuffer, drawFrame, emitPlayback]);

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
    if (!audioBuffer) {
      return;
    }
    hasEverStartedRef.current = false;
    frozenHeadSecRef.current = null;
    playheadAnchorRef.current = { t0: 0, h0: 0 };
    onPlaybackUpdate?.({
      headSec: 0,
      durationSec: audioBuffer.duration,
      isPlaying: false,
      hasEverStarted: false
    });
  }, [audioBuffer, onPlaybackUpdate]);

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
