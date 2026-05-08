export type DecodedAudio = {
  samples: Float32Array;
  sampleRate: number;
  durationSec: number;
  /** Original decoded buffer for playback (multi-channel). Safe to use after `AudioContext` closes. */
  audioBuffer: AudioBuffer;
};

export async function decodeToMono(file: File): Promise<DecodedAudio> {
  const encodedBytes = await file.arrayBuffer();
  const audioContext = new AudioContext();

  try {
    const buffer = await audioContext.decodeAudioData(encodedBytes);
    const monoSamples = new Float32Array(buffer.length);

    for (let channelIndex = 0; channelIndex < buffer.numberOfChannels; channelIndex += 1) {
      const channelSamples = buffer.getChannelData(channelIndex);
      for (let sampleIndex = 0; sampleIndex < buffer.length; sampleIndex += 1) {
        monoSamples[sampleIndex] += channelSamples[sampleIndex] / buffer.numberOfChannels;
      }
    }

    return {
      samples: monoSamples,
      sampleRate: buffer.sampleRate,
      durationSec: buffer.duration,
      audioBuffer: buffer
    };
  } finally {
    await audioContext.close();
  }
}
