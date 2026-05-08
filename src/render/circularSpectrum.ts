/**
 * Radial frequency bars around a circle (spectrum ring).
 * `frequencyData` is typically from AnalyserNode.getByteFrequencyData (0–255).
 */
export function drawCircularSpectrum(
  ctx: CanvasRenderingContext2D,
  frequencyData: Uint8Array<ArrayBufferLike>,
  width: number,
  height: number,
  barCount: number
): void {
  const cx = width / 2;
  const cy = height / 2;
  const minDim = Math.min(width, height);
  const innerRadius = minDim * 0.14;
  const maxBarLength = minDim * 0.34;

  ctx.fillStyle = "#09090f";
  ctx.fillRect(0, 0, width, height);

  const binCount = frequencyData.length;
  const step = Math.max(1, Math.floor(binCount / barCount));

  ctx.lineCap = "round";

  for (let index = 0; index < barCount; index += 1) {
    const binIndex = Math.min(binCount - 1, Math.floor((index / barCount) * binCount));
    let sum = 0;
    let count = 0;
    for (let offset = 0; offset < step && binIndex + offset < binCount; offset += 1) {
      sum += frequencyData[binIndex + offset] ?? 0;
      count += 1;
    }
    const avg = count > 0 ? sum / count : 0;
    const magnitude = avg / 255;

    const angle = (index / barCount) * Math.PI * 2 - Math.PI / 2;
    const outerRadius = innerRadius + magnitude * maxBarLength;

    const hue = (index / barCount) * 280 + 160;
    ctx.strokeStyle = `hsla(${hue}, 85%, 58%, ${0.55 + magnitude * 0.45})`;
    ctx.lineWidth = Math.max(2, minDim * 0.012);

    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(angle) * innerRadius, cy + Math.sin(angle) * innerRadius);
    ctx.lineTo(cx + Math.cos(angle) * outerRadius, cy + Math.sin(angle) * outerRadius);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(120, 140, 255, 0.35)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, innerRadius - 2, 0, Math.PI * 2);
  ctx.stroke();
}
