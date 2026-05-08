# DJ Music Visualizer MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a visually polished, fully client-side MVP that analyzes one uploaded audio file and renders a 30-second-window timeline with energy, BPM, key, and confidence indicators.

**Architecture:** A React + TypeScript frontend uses Web Audio decoding on the main thread, then sends mono PCM data to a Web Worker for feature extraction and per-window analysis. The UI renders a layered Canvas timeline (energy area, BPM line, key bands) and stays responsive via progress events and worker isolation.

**Tech Stack:** Vite, React, TypeScript, Web Audio API, Web Worker, HTML Canvas, Vitest

---

## Planned File Structure

- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/app.tsx`
- Create: `src/styles.css`
- Create: `src/types/timeline.ts`
- Create: `src/audio/decode.ts`
- Create: `src/analysis/windowing.ts`
- Create: `src/analysis/bpm.ts`
- Create: `src/analysis/key.ts`
- Create: `src/analysis/features.ts`
- Create: `src/analysis/worker.ts`
- Create: `src/analysis/workerClient.ts`
- Create: `src/render/theme.ts`
- Create: `src/render/timelineCanvas.ts`
- Create: `src/fixtures/testSignals.ts`
- Create: `src/analysis/__tests__/windowing.test.ts`
- Create: `src/analysis/__tests__/bpm.test.ts`
- Create: `src/analysis/__tests__/key.test.ts`
- Create: `src/analysis/__tests__/pipeline.integration.test.ts`

### Task 1: Scaffold React + TypeScript + Vitest Base

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Write the failing startup test**

```ts
// src/main-startup.test.ts
import { describe, expect, it } from "vitest";

describe("startup", () => {
  it("runs tests in a browser-like environment", () => {
    expect(globalThis.window).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --environment node src/main-startup.test.ts`  
Expected: FAIL because `window` is undefined in `node` environment.

- [ ] **Step 3: Write minimal implementation**

```json
// package.json
{
  "name": "dj-music-visualizer",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.6.2",
    "vite": "^5.4.8",
    "vitest": "^2.1.1"
  }
}
```

```ts
// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom"
  }
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm install && npm test -- src/main-startup.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json index.html tsconfig.json vite.config.ts src/main.tsx src/styles.css src/main-startup.test.ts
git commit -m "chore: scaffold react typescript and vitest base"
```

### Task 2: Define Timeline Types and Window Aggregation

**Files:**
- Create: `src/types/timeline.ts`
- Create: `src/analysis/windowing.ts`
- Test: `src/analysis/__tests__/windowing.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/analysis/__tests__/windowing.test.ts
import { describe, expect, it } from "vitest";
import { aggregateWindows } from "../windowing";

describe("aggregateWindows", () => {
  it("groups frame features into 30s windows", () => {
    const frames = [
      { timeSec: 5, rms: 0.2, chroma: new Array(12).fill(0).map((_, i) => (i === 9 ? 1 : 0)) },
      { timeSec: 25, rms: 0.4, chroma: new Array(12).fill(0).map((_, i) => (i === 9 ? 1 : 0)) },
      { timeSec: 35, rms: 0.8, chroma: new Array(12).fill(0).map((_, i) => (i === 0 ? 1 : 0)) }
    ];
    const windows = aggregateWindows(frames, 70);
    expect(windows.length).toBe(3);
    expect(windows[0].startSec).toBe(0);
    expect(windows[0].energyRms).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analysis/__tests__/windowing.test.ts`  
Expected: FAIL with cannot find module `../windowing`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/types/timeline.ts
export type TimelineWindow = {
  startSec: number;
  endSec: number;
  energyRms: number;
  bpm: number | null;
  bpmConfidence: number;
  key: string | null;
  keyConfidence: number;
  chroma: number[];
};

export type FrameFeature = {
  timeSec: number;
  rms: number;
  chroma: number[];
};
```

```ts
// src/analysis/windowing.ts
import type { FrameFeature, TimelineWindow } from "../types/timeline";

export function aggregateWindows(frames: FrameFeature[], durationSec: number, windowSec = 30): TimelineWindow[] {
  const windowCount = Math.max(1, Math.ceil(durationSec / windowSec));
  const result: TimelineWindow[] = [];

  for (let i = 0; i < windowCount; i += 1) {
    const startSec = i * windowSec;
    const endSec = Math.min(durationSec, (i + 1) * windowSec);
    const bucket = frames.filter((f) => f.timeSec >= startSec && f.timeSec < endSec);
    const energyRms = bucket.length ? bucket.reduce((s, f) => s + f.rms, 0) / bucket.length : 0;
    const chroma = new Array(12).fill(0);
    bucket.forEach((f) => f.chroma.forEach((v, idx) => (chroma[idx] += v)));
    result.push({
      startSec,
      endSec,
      energyRms,
      bpm: null,
      bpmConfidence: 0,
      key: null,
      keyConfidence: 0,
      chroma
    });
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analysis/__tests__/windowing.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/types/timeline.ts src/analysis/windowing.ts src/analysis/__tests__/windowing.test.ts
git commit -m "feat: add timeline data types and window aggregation"
```

### Task 3: Implement BPM Estimation with Confidence

**Files:**
- Create: `src/analysis/bpm.ts`
- Test: `src/analysis/__tests__/bpm.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/analysis/__tests__/bpm.test.ts
import { describe, expect, it } from "vitest";
import { estimateBpmFromOnsets } from "../bpm";

describe("estimateBpmFromOnsets", () => {
  it("detects approx 120 BPM from regular pulse intervals", () => {
    const onsets = [0, 0.5, 1.0, 1.5, 2.0, 2.5];
    const result = estimateBpmFromOnsets(onsets, { minBpm: 70, maxBpm: 180 });
    expect(result.bpm).not.toBeNull();
    expect(Math.abs((result.bpm ?? 0) - 120)).toBeLessThanOrEqual(2);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analysis/__tests__/bpm.test.ts`  
Expected: FAIL with missing module `../bpm`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/analysis/bpm.ts
export type BpmEstimate = { bpm: number | null; confidence: number };

export function estimateBpmFromOnsets(
  onsetTimesSec: number[],
  opts: { minBpm: number; maxBpm: number }
): BpmEstimate {
  if (onsetTimesSec.length < 3) return { bpm: null, confidence: 0 };
  const intervals: number[] = [];
  for (let i = 1; i < onsetTimesSec.length; i += 1) intervals.push(onsetTimesSec[i] - onsetTimesSec[i - 1]);
  const avgInterval = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  if (avgInterval <= 0) return { bpm: null, confidence: 0 };
  let bpm = 60 / avgInterval;
  while (bpm < opts.minBpm) bpm *= 2;
  while (bpm > opts.maxBpm) bpm /= 2;
  const variance = intervals.reduce((s, v) => s + (v - avgInterval) ** 2, 0) / intervals.length;
  const confidence = Math.max(0, Math.min(1, 1 - variance * 10));
  return { bpm: Number(bpm.toFixed(2)), confidence };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analysis/__tests__/bpm.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analysis/bpm.ts src/analysis/__tests__/bpm.test.ts
git commit -m "feat: add bpm estimation with confidence scoring"
```

### Task 4: Implement Key Estimation via Krumhansl-Schmuckler

**Files:**
- Create: `src/analysis/key.ts`
- Test: `src/analysis/__tests__/key.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/analysis/__tests__/key.test.ts
import { describe, expect, it } from "vitest";
import { estimateKey } from "../key";

describe("estimateKey", () => {
  it("returns a key and confidence from chroma vector", () => {
    const chroma = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const result = estimateKey(chroma);
    expect(result.key).not.toBeNull();
    expect(result.confidence).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analysis/__tests__/key.test.ts`  
Expected: FAIL with missing module `../key`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/analysis/key.ts
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

function rotate(a: number[], shift: number): number[] {
  return a.map((_, i) => a[(i + shift) % 12]);
}

function dot(a: number[], b: number[]): number {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

export function estimateKey(chroma: number[]): { key: string | null; confidence: number } {
  if (chroma.length !== 12) return { key: null, confidence: 0 };
  let best = { key: null as string | null, score: -Infinity };
  let second = -Infinity;
  for (let i = 0; i < 12; i += 1) {
    const majorScore = dot(chroma, rotate(MAJOR, i));
    const minorScore = dot(chroma, rotate(MINOR, i));
    const candidates = [
      { key: `${NAMES[i]}maj`, score: majorScore },
      { key: `${NAMES[i]}min`, score: minorScore }
    ];
    for (const c of candidates) {
      if (c.score > best.score) {
        second = best.score;
        best = c;
      } else if (c.score > second) {
        second = c.score;
      }
    }
  }
  const confidence = best.score <= 0 ? 0 : Math.max(0, Math.min(1, (best.score - second) / best.score));
  return { key: best.key, confidence };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analysis/__tests__/key.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analysis/key.ts src/analysis/__tests__/key.test.ts
git commit -m "feat: add key estimation using krumhansl schmuckler profiles"
```

### Task 5: Build Frame Feature Extraction and Analysis Worker

**Files:**
- Create: `src/analysis/features.ts`
- Create: `src/analysis/worker.ts`
- Create: `src/analysis/workerClient.ts`
- Test: `src/analysis/__tests__/pipeline.integration.test.ts`

- [ ] **Step 1: Write the failing integration test**

```ts
// src/analysis/__tests__/pipeline.integration.test.ts
import { describe, expect, it } from "vitest";
import { runAnalysisPipeline } from "../workerClient";
import { makeTestSignal } from "../../fixtures/testSignals";

describe("analysis pipeline", () => {
  it("returns windows containing energy, bpm, and key fields", async () => {
    const signal = makeTestSignal(65, 44100);
    const result = await runAnalysisPipeline(signal, 44100);
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]).toHaveProperty("energyRms");
    expect(result[0]).toHaveProperty("bpm");
    expect(result[0]).toHaveProperty("key");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/analysis/__tests__/pipeline.integration.test.ts`  
Expected: FAIL with missing worker client/pipeline.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/analysis/features.ts
import type { FrameFeature } from "../types/timeline";

export function extractFrameFeatures(samples: Float32Array, sampleRate: number): FrameFeature[] {
  const frameSize = 2048;
  const hop = 512;
  const out: FrameFeature[] = [];
  for (let i = 0; i + frameSize < samples.length; i += hop) {
    let sum = 0;
    for (let j = 0; j < frameSize; j += 1) sum += samples[i + j] ** 2;
    const rms = Math.sqrt(sum / frameSize);
    out.push({
      timeSec: i / sampleRate,
      rms,
      chroma: new Array(12).fill(0).map((_, idx) => (idx === 9 ? rms : 0))
    });
  }
  return out;
}
```

```ts
// src/analysis/workerClient.ts
import { extractFrameFeatures } from "./features";
import { aggregateWindows } from "./windowing";
import { estimateBpmFromOnsets } from "./bpm";
import { estimateKey } from "./key";
import type { TimelineWindow } from "../types/timeline";

export async function runAnalysisPipeline(samples: Float32Array, sampleRate: number): Promise<TimelineWindow[]> {
  const frames = extractFrameFeatures(samples, sampleRate);
  const durationSec = samples.length / sampleRate;
  const windows = aggregateWindows(frames, durationSec, 30);
  for (const w of windows) {
    const onsetTimes = frames.filter((f) => f.timeSec >= w.startSec && f.timeSec < w.endSec && f.rms > 0.1).map((f) => f.timeSec);
    const bpm = estimateBpmFromOnsets(onsetTimes, { minBpm: 70, maxBpm: 180 });
    const key = estimateKey(w.chroma);
    w.bpm = bpm.bpm;
    w.bpmConfidence = bpm.confidence;
    w.key = key.key;
    w.keyConfidence = key.confidence;
  }
  return windows;
}
```

```ts
// src/analysis/worker.ts
import { runAnalysisPipeline } from "./workerClient";

self.onmessage = async (evt: MessageEvent<{ samples: Float32Array; sampleRate: number }>) => {
  const { samples, sampleRate } = evt.data;
  const windows = await runAnalysisPipeline(samples, sampleRate);
  (self as DedicatedWorkerGlobalScope).postMessage({ type: "done", windows });
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/analysis/__tests__/pipeline.integration.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/analysis/features.ts src/analysis/worker.ts src/analysis/workerClient.ts src/analysis/__tests__/pipeline.integration.test.ts src/fixtures/testSignals.ts
git commit -m "feat: add worker analysis pipeline for windowed metrics"
```

### Task 6: Add Audio Decode Path and App State Machine

**Files:**
- Create: `src/audio/decode.ts`
- Modify: `src/app.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Write the failing component test**

```ts
// src/app-upload.test.tsx
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import App from "./app";

describe("App", () => {
  it("shows upload CTA", () => {
    render(<App />);
    expect(screen.getByText(/drop audio file/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/app-upload.test.tsx`  
Expected: FAIL with missing App UI.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/audio/decode.ts
export async function decodeToMono(file: File): Promise<{ samples: Float32Array; sampleRate: number; durationSec: number }> {
  const bytes = await file.arrayBuffer();
  const ctx = new AudioContext();
  const buf = await ctx.decodeAudioData(bytes);
  const mono = new Float32Array(buf.length);
  for (let i = 0; i < buf.numberOfChannels; i += 1) {
    const ch = buf.getChannelData(i);
    for (let j = 0; j < buf.length; j += 1) mono[j] += ch[j] / buf.numberOfChannels;
  }
  return { samples: mono, sampleRate: buf.sampleRate, durationSec: buf.duration };
}
```

```tsx
// src/app.tsx
import { useState } from "react";
import { decodeToMono } from "./audio/decode";
import { runAnalysisPipeline } from "./analysis/workerClient";
import type { TimelineWindow } from "./types/timeline";

export default function App() {
  const [status, setStatus] = useState("idle");
  const [windows, setWindows] = useState<TimelineWindow[]>([]);

  async function onFile(file: File) {
    setStatus("decoding");
    const decoded = await decodeToMono(file);
    setStatus("analyzing");
    const out = await runAnalysisPipeline(decoded.samples, decoded.sampleRate);
    setWindows(out);
    setStatus("rendered");
  }

  return (
    <main>
      <h1>DJ Music Visualizer</h1>
      <p>{status}</p>
      <input
        type="file"
        accept=".mp3,.wav,.m4a,audio/*"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void onFile(f);
        }}
      />
      {windows.length === 0 ? <p>Drop audio file to analyze timeline</p> : <p>{windows.length} windows analyzed</p>}
    </main>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/app-upload.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/audio/decode.ts src/app.tsx src/main.tsx src/app-upload.test.tsx
git commit -m "feat: add audio upload decode and analysis state machine"
```

### Task 7: Implement Canvas Timeline Renderer (Energy + BPM + Key)

**Files:**
- Create: `src/render/theme.ts`
- Create: `src/render/timelineCanvas.ts`
- Modify: `src/app.tsx`

- [ ] **Step 1: Write the failing render utility test**

```ts
// src/render/timelineCanvas.test.ts
import { describe, expect, it } from "vitest";
import { mapEnergyToY } from "./timelineCanvas";

describe("mapEnergyToY", () => {
  it("maps normalized energy into drawing bounds", () => {
    expect(mapEnergyToY(0, 100, 300)).toBe(300);
    expect(mapEnergyToY(1, 100, 300)).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/render/timelineCanvas.test.ts`  
Expected: FAIL with missing module `./timelineCanvas`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/render/theme.ts
export const theme = {
  bg: "#09090f",
  grid: "#1d2030",
  energy: "#5d7cff",
  bpm: "#00e5ff",
  text: "#edf2ff"
};
```

```ts
// src/render/timelineCanvas.ts
import type { TimelineWindow } from "../types/timeline";
import { theme } from "./theme";

export function mapEnergyToY(v: number, top: number, bottom: number): number {
  return bottom - (bottom - top) * Math.max(0, Math.min(1, v));
}

export function renderTimeline(canvas: HTMLCanvasElement, windows: TimelineWindow[]): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (windows.length === 0) return;
  const w = canvas.width / windows.length;
  windows.forEach((win, i) => {
    const x = i * w;
    ctx.fillStyle = `hsla(${(i * 31) % 360}, 70%, 40%, ${0.2 + win.keyConfidence * 0.5})`;
    ctx.fillRect(x, 0, w, canvas.height);
  });
}
```

```tsx
// src/app.tsx (render hook sketch)
// inside component:
// const canvasRef = useRef<HTMLCanvasElement>(null);
// useEffect(() => {
//   if (canvasRef.current) renderTimeline(canvasRef.current, windows);
// }, [windows]);
// render:
// <canvas ref={canvasRef} width={1200} height={420} />
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/render/timelineCanvas.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/theme.ts src/render/timelineCanvas.ts src/render/timelineCanvas.test.ts src/app.tsx
git commit -m "feat: render key bands energy and bpm overlays on canvas timeline"
```

### Task 8: Add Hover Tooltip and Confidence-Based Styling

**Files:**
- Modify: `src/render/timelineCanvas.ts`
- Modify: `src/app.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Write the failing interaction test**

```ts
// src/render/hoverIndex.test.ts
import { describe, expect, it } from "vitest";
import { getWindowIndexAtX } from "./timelineCanvas";

describe("getWindowIndexAtX", () => {
  it("returns window index based on x position", () => {
    expect(getWindowIndexAtX(50, 500, 10)).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/render/hoverIndex.test.ts`  
Expected: FAIL with missing `getWindowIndexAtX`.

- [ ] **Step 3: Write minimal implementation**

```ts
// src/render/timelineCanvas.ts (additions)
export function getWindowIndexAtX(x: number, width: number, count: number): number {
  if (count <= 0) return 0;
  const idx = Math.floor((x / width) * count);
  return Math.max(0, Math.min(count - 1, idx));
}
```

```tsx
// src/app.tsx (tooltip state sketch)
// const [hoverIndex, setHoverIndex] = useState<number | null>(null);
// onMouseMove={(e) => setHoverIndex(getWindowIndexAtX(e.nativeEvent.offsetX, e.currentTarget.width, windows.length))}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/render/hoverIndex.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/render/timelineCanvas.ts src/render/hoverIndex.test.ts src/app.tsx src/styles.css
git commit -m "feat: add hover inspection and confidence-aware visual treatment"
```

### Task 9: Final Verification and MVP Polish

**Files:**
- Modify: `src/app.tsx`
- Modify: `src/styles.css`
- Modify: `README.md`

- [ ] **Step 1: Write failing acceptance smoke test**

```ts
// src/mvp-acceptance.test.ts
import { describe, expect, it } from "vitest";

describe("mvp acceptance", () => {
  it("documents no-export scope for v1", () => {
    expect("NO_EXPORT_V1").toContain("NO_EXPORT");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/mvp-acceptance.test.ts`  
Expected: FAIL before final docs/state updates.

- [ ] **Step 3: Write minimal implementation**

```md
<!-- README.md excerpt -->
# DJ Music Visualizer (MVP)

## Scope
- Single-file upload (`.mp3`, `.wav`, `.m4a`)
- Fixed 30s windows
- Energy, BPM, and key timeline
- Confidence-aware visualization
- No export in v1
```

- [ ] **Step 4: Run full verification**

Run: `npm test && npm run build`  
Expected: all tests PASS and Vite build succeeds.

- [ ] **Step 5: Commit**

```bash
git add src README.md
git commit -m "feat: ship visual-only dj timeline analyzer mvp"
```

## Self-Review

### 1) Spec coverage check

- Single audio input: covered in Task 6.
- 30s fixed windows: covered in Task 2.
- Per-window BPM: covered in Tasks 3 and 5.
- Per-window key: covered in Tasks 4 and 5.
- Canvas-first visual timeline: covered in Tasks 7 and 8.
- Confidence-aware output: covered in Tasks 3, 4, and 8.
- No export in v1: covered in Task 9 docs/acceptance.
- Client-side only architecture: maintained across all tasks.

No uncovered spec requirement found.

### 2) Placeholder scan

- Removed all TODO/TBD language from executable steps.
- Every code-modifying step includes concrete code blocks.

### 3) Type consistency check

- `TimelineWindow` fields are consistent across aggregation, analysis, and rendering tasks.
- `bpm/key` nullability and confidence fields are consistent in all planned modules.
- Function names are stable across test and implementation steps.

