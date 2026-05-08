import type { AnalysisFrame } from "../types/timeline";

const CHROMA_FREQUENCIES_HZ = [
  261.63, 277.18, 293.66, 311.13, 329.63, 349.23,
  369.99, 392.0, 415.3, 440.0, 466.16, 493.88
] as const;

function energyAtFrequency(
  samples: Float32Array,
  offset: number,
  frameSize: number,
  sampleRate: number,
  frequencyHz: number
): number {
  let real = 0;
  let imag = 0;
  for (let index = 0; index < frameSize; index += 1) {
    const phase = (2 * Math.PI * frequencyHz * index) / sampleRate;
    const sample = samples[offset + index] ?? 0;
    real += sample * Math.cos(phase);
    imag -= sample * Math.sin(phase);
  }
  return (real * real + imag * imag) / Math.max(1, frameSize * frameSize);
}

function computeChroma(
  samples: Float32Array,
  offset: number,
  frameSize: number,
  sampleRate: number
): number[] {
  return CHROMA_FREQUENCIES_HZ.map((frequencyHz) =>
    energyAtFrequency(samples, offset, frameSize, sampleRate, frequencyHz)
  );
}

function computeRms(samples: Float32Array, offset: number, frameSize: number): number {
  let sum = 0;
  for (let index = 0; index < frameSize; index += 1) {
    const sample = samples[offset + index] ?? 0;
    sum += sample * sample;
  }
  return Math.sqrt(sum / Math.max(1, frameSize));
}

export function extractFrameFeatures(
  samples: Float32Array,
  sampleRate: number,
  opts?: { frameSize?: number; hopSize?: number }
): AnalysisFrame[] {
  const frameSize = opts?.frameSize ?? 2048;
  const hopSize = opts?.hopSize ?? 512;
  if (sampleRate <= 0) {
    throw new Error("sampleRate must be greater than 0");
  }
  if (frameSize <= 0 || hopSize <= 0) {
    throw new Error("frameSize and hopSize must be greater than 0");
  }

  const frames: AnalysisFrame[] = [];
  for (let offset = 0; offset + frameSize <= samples.length; offset += hopSize) {
    frames.push({
      timeSec: offset / sampleRate,
      rms: computeRms(samples, offset, frameSize),
      chroma: computeChroma(samples, offset, frameSize, sampleRate)
    });
  }

  return frames;
}
