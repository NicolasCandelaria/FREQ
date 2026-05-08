import { describe, expect, it, vi } from "vitest";
import type { TimelineWindow } from "../types/timeline";
import { mapEnergyToY, renderTimeline } from "./timelineCanvas";

describe("mapEnergyToY", () => {
  it("maps normalized energy into drawing bounds", () => {
    expect(mapEnergyToY(0, 100, 300)).toBe(300);
    expect(mapEnergyToY(1, 100, 300)).toBe(100);
  });
});

describe("renderTimeline", () => {
  it("draws key bands and energy/bpm overlays", () => {
    const fillRect = vi.fn();
    const beginPath = vi.fn();
    const moveTo = vi.fn();
    const lineTo = vi.fn();
    const closePath = vi.fn();
    const fill = vi.fn();
    const stroke = vi.fn();

    const mockContext = {
      fillStyle: "#000000",
      strokeStyle: "#000000",
      lineWidth: 1,
      beginPath,
      moveTo,
      lineTo,
      closePath,
      fill,
      stroke,
      fillRect
    } as unknown as CanvasRenderingContext2D;

    const canvas = {
      width: 600,
      height: 240,
      getContext: vi.fn().mockReturnValue(mockContext)
    } as unknown as HTMLCanvasElement;

    const windows: TimelineWindow[] = [
      {
        startSec: 0,
        endSec: 30,
        energyRms: 0.2,
        bpm: 120,
        bpmConfidence: 0.8,
        key: "Am",
        keyConfidence: 0.6
      },
      {
        startSec: 30,
        endSec: 60,
        energyRms: 0.7,
        bpm: 128,
        bpmConfidence: 0.7,
        key: "C",
        keyConfidence: 0.9
      }
    ];

    renderTimeline(canvas, windows);

    expect(fillRect).toHaveBeenCalledTimes(3);
    expect(beginPath).toHaveBeenCalledTimes(3);
    expect(fill).toHaveBeenCalledTimes(1);
    expect(stroke).toHaveBeenCalledTimes(2);
  });

  it("uses stable band color for the same key", () => {
    const fillRect = vi.fn();
    const fillStyles: string[] = [];
    let currentFillStyle = "#000000";
    const mockContext = {
      strokeStyle: "#000000",
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: (...args: Parameters<typeof fillRect>) => {
        fillStyles.push(currentFillStyle);
        fillRect(...args);
      },
      set fillStyle(value: string) {
        currentFillStyle = value;
      },
      get fillStyle() {
        return currentFillStyle;
      }
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 600,
      height: 240,
      getContext: vi.fn().mockReturnValue(mockContext)
    } as unknown as HTMLCanvasElement;
    const windows: TimelineWindow[] = [
      { startSec: 0, endSec: 30, energyRms: 0.2, bpm: 120, bpmConfidence: 0.8, key: "Am", keyConfidence: 0.6 },
      { startSec: 30, endSec: 60, energyRms: 0.3, bpm: 122, bpmConfidence: 0.8, key: "Am", keyConfidence: 0.6 }
    ];

    renderTimeline(canvas, windows);

    expect(fillStyles[1]).toBe(fillStyles[2]);
  });

  it("uses distinct hues for different keys", () => {
    const fillStyles: string[] = [];
    let currentFillStyle = "#000000";
    const mockContext = {
      strokeStyle: "#000000",
      lineWidth: 1,
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      closePath: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillRect: () => {
        fillStyles.push(currentFillStyle);
      },
      set fillStyle(value: string) {
        currentFillStyle = value;
      },
      get fillStyle() {
        return currentFillStyle;
      }
    } as unknown as CanvasRenderingContext2D;
    const canvas = {
      width: 600,
      height: 240,
      getContext: vi.fn().mockReturnValue(mockContext)
    } as unknown as HTMLCanvasElement;
    const windows: TimelineWindow[] = [
      { startSec: 0, endSec: 30, energyRms: 0.2, bpm: 120, bpmConfidence: 0.8, key: "Am", keyConfidence: 0.6 },
      { startSec: 30, endSec: 60, energyRms: 0.3, bpm: 122, bpmConfidence: 0.8, key: "C", keyConfidence: 0.6 }
    ];

    renderTimeline(canvas, windows);

    expect(fillStyles[1]).not.toBe(fillStyles[2]);
  });
});
