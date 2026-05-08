/** Thresholds aligned with tooltip confidence pill styling */
const HIGH_THRESHOLD = 0.75;
const MEDIUM_THRESHOLD = 0.45;

export type ConfidenceTier = "high" | "medium" | "low";

export function getConfidenceTier(confidence: number): ConfidenceTier {
  const c = Math.max(0, Math.min(1, confidence));
  if (c >= HIGH_THRESHOLD) {
    return "high";
  }
  if (c >= MEDIUM_THRESHOLD) {
    return "medium";
  }
  return "low";
}

export function confidencePillModifiers(confidence: number): string {
  const tier = getConfidenceTier(confidence);
  return `confidence-pill confidence-pill--${tier}`;
}
