import type { TimelineWindow } from "../types/timeline";
import { theme } from "./theme";

const MIN_BPM = 70;
const MAX_BPM = 180;

export function mapEnergyToY(v: number, top: number, bottom: number): number {
  const normalized = Math.max(0, Math.min(1, v));
  return bottom - (bottom - top) * normalized;
}

export function getWindowIndexAtX(x: number, width: number, count: number): number {
  if (count <= 0 || width <= 0 || !Number.isFinite(x)) {
    return 0;
  }
  const rawIndex = Math.floor((x / width) * count);
  return Math.max(0, Math.min(count - 1, rawIndex));
}

function mapBpmToY(bpm: number, top: number, bottom: number): number {
  const normalized = Math.max(0, Math.min(1, (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)));
  return bottom - (bottom - top) * normalized;
}

function mapKeyToHue(key: string | null): number {
  if (!key) {
    return 0;
  }
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

function getKeyBandColor(key: string | null, keyConfidence: number): string {
  const confidence = Math.max(0, Math.min(1, keyConfidence));
  const alpha = 0.14 + confidence * 0.45;
  const hue = mapKeyToHue(key);
  const saturation = 45 + confidence * 35;
  const lightness = 22 + confidence * 18;
  return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
}

export function renderTimeline(
  canvas: HTMLCanvasElement,
  windows: TimelineWindow[],
  options?: { hoverIndex?: number | null }
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  const width = canvas.width;
  const height = canvas.height;
  const topPadding = 12;
  const bottomPadding = 12;
  const chartTop = topPadding;
  const chartBottom = height - bottomPadding;

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, width, height);

  if (windows.length === 0) {
    return;
  }

  const bandWidth = width / windows.length;
  windows.forEach((window, index) => {
    const x = index * bandWidth;
    const confidence = Math.max(0, Math.min(1, Math.max(window.keyConfidence, window.bpmConfidence)));
    const isHovered = options?.hoverIndex === index;

    ctx.fillStyle = getKeyBandColor(window.key, window.keyConfidence);
    ctx.fillRect(x, 0, bandWidth, height);

    const uncertaintyAlpha = (1 - confidence) * 0.35;
    if (uncertaintyAlpha > 0) {
      ctx.fillStyle = `rgba(10, 10, 18, ${uncertaintyAlpha})`;
      ctx.fillRect(x, 0, bandWidth, height);
    }

    if (isHovered) {
      ctx.fillStyle = `rgba(237, 242, 255, ${0.08 + confidence * 0.18})`;
      ctx.fillRect(x, 0, bandWidth, height);
    }
  });

  ctx.beginPath();
  ctx.moveTo(0, chartBottom);
  windows.forEach((window, index) => {
    const x = (index + 0.5) * bandWidth;
    const y = mapEnergyToY(window.energyRms, chartTop, chartBottom);
    ctx.lineTo(x, y);
  });
  ctx.lineTo(width, chartBottom);
  ctx.closePath();
  ctx.fillStyle = theme.energyArea;
  ctx.fill();

  ctx.beginPath();
  windows.forEach((window, index) => {
    const x = (index + 0.5) * bandWidth;
    const y = mapEnergyToY(window.energyRms, chartTop, chartBottom);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.strokeStyle = theme.energyLine;
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let index = 1; index < windows.length; index += 1) {
    const previous = windows[index - 1];
    const current = windows[index];
    if (previous.bpm === null || current.bpm === null) {
      continue;
    }
    const x1 = (index - 0.5) * bandWidth;
    const x2 = (index + 0.5) * bandWidth;
    const y1 = mapBpmToY(previous.bpm, chartTop, chartBottom);
    const y2 = mapBpmToY(current.bpm, chartTop, chartBottom);
    const confidence = Math.max(
      0,
      Math.min(1, (previous.bpmConfidence + current.bpmConfidence) / 2)
    );
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = `rgba(0, 229, 255, ${0.2 + confidence * 0.8})`;
    ctx.lineWidth = 1 + confidence * 1.5;
    ctx.stroke();
  }

  if (options?.hoverIndex !== null && options?.hoverIndex !== undefined) {
    const hoverWindow = windows[options.hoverIndex];
    const hoverConfidence = hoverWindow
      ? Math.max(0, Math.min(1, Math.max(hoverWindow.keyConfidence, hoverWindow.bpmConfidence)))
      : 0;
    const x = (options.hoverIndex + 0.5) * bandWidth;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.strokeStyle = `rgba(237, 242, 255, ${0.35 + hoverConfidence * 0.55})`;
    ctx.lineWidth = 1 + hoverConfidence;
    ctx.stroke();
  }
}
