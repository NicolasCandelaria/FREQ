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

## GitHub Pages

Live site (after deploy succeeds): **https://NicolasCandelaria.github.io/FREQ/**

### One-time setup

1. In the repo on GitHub: **Settings → Pages → Build and deployment**.
2. Under **Source**, choose **GitHub Actions** (not “Deploy from a branch”).

### Deploy

Pushes to **`master`** run `.github/workflows/deploy-pages.yml`, which runs `npm ci`, `npm run build`, and publishes the **`dist/`** folder to Pages.

If you rename the repository, edit `GITHUB_PAGES_BASE` in `vite.config.ts` so it matches `/YourRepoName/` (leading and trailing slashes as shown).

Local preview of the production bundle:

```bash
npm run build && npm run preview
```

Then open the printed URL (visit **`/FREQ/`** path only if your preview serves from root; `vite preview` respects the built `base`).
