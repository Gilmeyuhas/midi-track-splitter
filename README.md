# MIDI Track Splitter

A small browser-based utility that splits a multitrack `.mid`/`.midi` file into one MIDI file per musical track, then downloads everything in a ZIP.

## What this tool does

- Upload one MIDI file with multiple tracks.
- Detect exportable musical tracks.
- Rename tracks before export.
- Include/exclude tracks using checkboxes.
- Download a ZIP that contains one MIDI per selected track.
- Preserve timing exactly (including delayed starts).
- Preserve global tempo/time-signature metadata by carrying conductor track data into each output when detected.

## Why this runs fully in the browser

GitHub Pages hosts static files only. This app runs 100% client-side with vanilla JavaScript, so no backend is needed. Your uploaded MIDI file is parsed and processed locally in your browser.

## Local development

```bash
npm install
npm run dev
```

Then open the local Vite URL (usually `http://localhost:5173`).

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages deployment

This repo includes `.github/workflows/deploy-pages.yml` which:

1. Runs on pushes to `main` (and manual trigger).
2. Installs dependencies with `npm ci`.
3. Builds with `npm run build`.
4. Uploads `dist/` as a Pages artifact.
5. Deploys to GitHub Pages.

## Limitations and edge cases

- Global/conductor detection uses a heuristic: track 0 must have no channel events and at least one non-`endOfTrack` meta event.
- Tracks with no channel events are not exported.
- Corrupted/invalid MIDI files will be rejected.
- Duplicate output names are automatically de-duplicated (`Name`, `Name (2)`, `Name (3)`, ...).
- Illegal filename characters are stripped from output names.

## Privacy

Uploaded MIDI files never leave your browser. No server upload, telemetry, analytics, or cloud storage is used.
