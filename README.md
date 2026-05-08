# DJ Music Visualizer (MVP)

Visual-only, client-side timeline analyzer for one track at a time.

## v1 Scope

- Single file input only (`.mp3`, `.wav`, `.m4a`)
- Fixed 30-second analysis windows
- Per-window energy, BPM, and key analysis
- Confidence-aware UI treatment for BPM/key certainty
- No export in v1

## What It Does

The app decodes one supported audio file in the browser, analyzes it in a worker, and renders an interactive timeline for inspection. Hovering the timeline surfaces window-level metrics and confidence values.

After analysis completes, use **Play** under **Live spectrum** to hear the track and watch **radial frequency bars** bounce around a circle (Web Audio `AnalyserNode`, synced to playback).

## What Is Out of Scope (v1)

- Multi-file or playlist analysis
- Video/audio container inputs outside the supported formats
- Exporting JSON, image, or other artifacts
