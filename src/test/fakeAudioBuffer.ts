/** Minimal AudioBuffer stub for tests (playback APIs not exercised). */
export function createFakeAudioBuffer(overrides?: Partial<{ duration: number; sampleRate: number }>): AudioBuffer {
  const duration = overrides?.duration ?? 1;
  const sampleRate = overrides?.sampleRate ?? 44_100;
  const length = Math.max(1, Math.floor(duration * sampleRate));
  return {
    duration,
    sampleRate,
    length,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(length).fill(0.001)
  } as unknown as AudioBuffer;
}
