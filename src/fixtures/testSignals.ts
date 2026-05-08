type TestSignalOptions = {
  pulseBpm?: number;
  keyBiasIndex?: number;
};

const CHROMA_FREQUENCIES_HZ = [
  261.63, 277.18, 293.66, 311.13, 329.63, 349.23,
  369.99, 392.0, 415.3, 440.0, 466.16, 493.88
] as const;

function clampIndex(index: number): number {
  const wrapped = index % 12;
  return wrapped < 0 ? wrapped + 12 : wrapped;
}

export function makeTestSignal(
  durationSec: number,
  sampleRate: number,
  options?: TestSignalOptions
): Float32Array {
  const safeDuration = Math.max(0, durationSec);
  const totalSamples = Math.floor(safeDuration * sampleRate);
  const samples = new Float32Array(totalSamples);

  if (totalSamples === 0 || sampleRate <= 0) {
    return samples;
  }

  const pulseBpm = options?.pulseBpm ?? 120;
  const pulseIntervalSamples = Math.max(1, Math.floor((60 / pulseBpm) * sampleRate));
  const pulseLengthSamples = Math.max(1, Math.floor(sampleRate * 0.02));

  const keyBiasIndex = clampIndex(options?.keyBiasIndex ?? 9);
  const baseFrequency = CHROMA_FREQUENCIES_HZ[keyBiasIndex];
  const accentFrequency = CHROMA_FREQUENCIES_HZ[clampIndex(keyBiasIndex + 7)];

  for (let index = 0; index < totalSamples; index += 1) {
    const timeSec = index / sampleRate;
    const tonal =
      0.09 * Math.sin(2 * Math.PI * baseFrequency * timeSec) +
      0.04 * Math.sin(2 * Math.PI * accentFrequency * timeSec);

    const pulsePhase = index % pulseIntervalSamples;
    const pulseEnvelope =
      pulsePhase < pulseLengthSamples ? 1 - pulsePhase / pulseLengthSamples : 0;
    const pulse = 0.45 * pulseEnvelope;

    samples[index] = tonal + pulse;
  }

  return samples;
}
