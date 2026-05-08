# DJ Music Visualizer Design

Date: 2026-05-08
Status: Draft approved in chat, written for review
Scope: MVP design only (no implementation yet)

## 1. Goal

Build a visually polished, client-side DJ music visualizer that analyzes one uploaded audio track and renders a timeline showing:

- Energy curve over time
- BPM over time
- Musical key over time

The MVP is a flex project focused on strong visual presentation and smooth UX. No backend is used.

## 2. Confirmed MVP Decisions

- Analysis segmentation: fixed windows (30 seconds)
- Input handling: one audio file only (`.mp3`, `.wav`, `.m4a`)
- BPM display: per-window BPM (not global-only)
- Key display: per-window key (not global-only)
- Export: no export in v1 (visual-only MVP)
- Preferred architecture: Canvas-first rendering with analysis off the main thread

## 3. Product Experience

### 3.1 User Flow

1. User drags or selects one audio file.
2. App validates format and decodes audio.
3. App runs offline analysis and shows staged progress.
4. App renders a cinematic timeline with hover details.
5. User inspects structure and transitions across the track.

### 3.2 UX States

- `idle`: upload CTA and supported format hint
- `decoding`: progress text, basic metadata
- `analyzing`: staged progress (energy/chroma/bpm/key)
- `rendered`: full timeline with hover/crosshair interactions
- `error`: friendly message and reset action

### 3.3 Visual Direction

- Dark "club" aesthetic
- Neon accent palette
- Smooth line and area rendering
- High contrast for readability in low-light environments
- Subtle motion only where it improves legibility

## 4. Technical Architecture (Client-Side Only)

### 4.1 Core Modules

- `AudioLoader`
  - Accepts file input and validates MIME/extension
  - Decodes to PCM using Web Audio APIs
  - Produces mono analysis buffer and metadata

- `AnalysisWorker`
  - Runs heavy DSP and aggregation in a Web Worker
  - Emits progress events
  - Returns finalized window-level timeline data

- `FeaturePipeline`
  - Computes frame-level features (RMS, chroma inputs)
  - Aggregates frame features into fixed windows

- `BpmEstimator`
  - Computes onset envelope
  - Applies autocorrelation inside bounded tempo range
  - Returns BPM + confidence per window

- `KeyEstimator`
  - Aggregates chroma by window
  - Runs Krumhansl-Schmuckler scoring across all keys
  - Returns key + confidence per window

- `TimelineRenderer` (Canvas)
  - Draws energy area, BPM line, and key bands
  - Handles resize and hover interactions
  - Keeps render path separate from analysis path

### 4.2 Threading Model

- Main thread:
  - File input
  - App state and progress UI
  - Canvas rendering and interactions

- Worker thread:
  - Feature extraction
  - BPM and key estimation
  - Window aggregation

This split is required to keep the UI responsive on longer tracks.

## 5. Data Contract

The renderer consumes a window-level array only:

```ts
type TimelineWindow = {
  startSec: number;
  endSec: number;
  energyRms: number;       // normalized 0..1
  bpm: number | null;      // null when confidence is too low
  bpmConfidence: number;   // 0..1
  key: string | null;      // example: "Am", "C#", optional null if unknown
  keyConfidence: number;   // 0..1
};
```

Notes:

- Raw frame data is not required by rendering once window values are finalized.
- Confidence is first-class in the contract to avoid false precision in weak segments.

## 6. Analysis Design

### 6.1 Windowing

- Output window size: 30 seconds (fixed)
- Internal frame size/hop is shorter for fidelity
- Frame features are pooled into the containing output window

### 6.2 Energy

- Compute frame RMS
- Aggregate to window level (mean or robust mean)
- Normalize with robust percentile scaling to preserve dynamic contrast
- Apply light smoothing between adjacent windows for visual continuity

### 6.3 BPM

- Build onset envelope (spectral flux or low-frequency energy delta)
- Autocorrelate in a bounded tempo range (target default 70-180 BPM)
- Apply simple half/double tempo correction heuristics
- Output BPM and confidence per window
- When confidence is below threshold, set BPM to null and style as uncertain

### 6.4 Key

- Aggregate chroma vectors per window
- Score against Krumhansl major/minor templates for all 12 roots
- Select highest-scoring key
- Confidence based on margin between top two scores
- Lower-opacity key band styling for low-confidence windows

## 7. Rendering Design (Canvas-First)

### 7.1 Layers

1. Background grid and axes
2. Key bands (window blocks)
3. Energy filled area curve
4. BPM polyline/curve overlay
5. Interactive crosshair and tooltip

### 7.2 Interaction

- Hover or scrub to inspect nearest window
- Tooltip includes:
  - Time range
  - BPM + confidence
  - Key + confidence
  - Energy value

### 7.3 Performance Constraints

- Render should remain smooth while resizing and hovering
- Avoid re-analysis on visual-only interactions
- Cache geometry where useful

## 8. Error Handling and Edge Cases

- Unsupported file type -> immediate validation error
- Decode failure -> actionable error message
- Very short tracks -> enforce minimum duration or adapt with warning
- Silent/ambient windows -> allow null BPM and low-confidence key
- Genre drift / weak tonal center -> confidence-driven transparency rather than fake certainty

## 9. Proposed Project Structure

- `src/app.tsx`
- `src/audio/decode.ts`
- `src/analysis/worker.ts`
- `src/analysis/features.ts`
- `src/analysis/windowing.ts`
- `src/analysis/bpm.ts`
- `src/analysis/key.ts`
- `src/render/timelineCanvas.ts`
- `src/render/theme.ts`
- `src/types/timeline.ts`

## 10. Verification Strategy

### 10.1 Unit Tests

- Window aggregation math
- BPM sanity using synthetic click patterns
- Key scorer sanity using synthetic chroma distributions

### 10.2 Integration

- Fixture audio file -> non-empty timeline windows
- Range and nullability checks for each metric

### 10.3 Manual QA

- Analyze 3-5 tracks of different styles
- Validate readability, hover responsiveness, and confidence signaling

## 11. MVP Acceptance Criteria

1. User uploads one supported audio file.
2. App computes per-30s windows with energy, BPM, key, and confidence.
3. Timeline shows all three signals in one coordinated view.
4. Low-confidence windows are clearly differentiated visually.
5. UI remains responsive during analysis.
6. Entire solution runs in-browser, fully client-side.
7. No export feature included in v1.

## 12. Out of Scope for MVP

- Video container input (`.mp4`)
- Playlist or multi-file analysis
- Export to JSON/PNG
- Beat/bar-aligned segmentation modes
- Cloud sync or sharing

## 13. Self-Review Notes

- Placeholder scan: no TODO/TBD placeholders remain.
- Consistency check: architecture, data contract, and acceptance criteria align.
- Scope check: focused on one MVP; non-MVP items are explicitly excluded.
- Ambiguity reduction: confidence behavior and null handling are explicitly defined.
