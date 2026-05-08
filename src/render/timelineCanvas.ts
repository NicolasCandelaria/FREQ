import type { TimelineWindow } from "../types/timeline";
import { theme } from "./theme";

const MIN_BPM = 70;
const MAX_BPM = 180;

export function mapEnergyToY(v: number, top: number, bottom: number): number {
  const normalized = Math.max(0, Math.min(1, v));
  return bottom - (bottom - top) * normalized;
}

function mapBpmToY(bpm: number, top: number, bottom: number): number {
  const normalized = Math.max(0, Math.min(1, (bpm - MIN_BPM) / (MAX_BPM - MIN_BPM)));
  return bottom - (bottom - top) * normalized;
}

function getKeyBandColor(windowIndex: number, keyConfidence: number): string {
  const alpha = 0.18 + Math.max(0, Math.min(1, keyConfidence)) * 0.35;
  const hue = (windowIndex * 31) % 360;
  return `hsla(${hue}, 70%, 40%, ${alpha})`;
}

export function renderTimeline(canvas: HTMLCanvasElement, windows: TimelineWindow[]): void {
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
    ctx.fillStyle = getKeyBandColor(index, window.keyConfidence);
    ctx.fillRect(x, 0, bandWidth, height);
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

  ctx.beginPath();
  let hasBpmPoint = false;
  windows.forEach((window, index) => {
    if (window.bpm === null) {
      return;
    }
    const x = (index + 0.5) * bandWidth;
    const y = mapBpmToY(window.bpm, chartTop, chartBottom);
    if (!hasBpmPoint) {
      ctx.moveTo(x, y);
      hasBpmPoint = true;
    } else {
      ctx.lineTo(x, y);
    }
  });
  if (hasBpmPoint) {
    ctx.strokeStyle = theme.bpmLine;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
