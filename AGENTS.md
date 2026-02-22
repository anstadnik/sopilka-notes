# Sopilka Notes

A sopilka (Ukrainian flute) practice game built with TypeScript, Vite, and PixiJS.

## Architecture

- `src/main.ts` — Entry point, UI setup, calibration flow, game loop
- `src/audio/AudioEngine.ts` — Mic input via Web Audio API (AnalyserNode, FFT 2048)
- `src/audio/PitchEngine.ts` — Pitch detection (pitchy), per-note calibration offsets, note locking (8 frames, 35 cents window)
- `src/music/MusicEngine.ts` — Scale generation via @tonaljs/tonal, solfege mapping, staff positions
- `src/game/GameEngine.ts` — Note spawning/scrolling, wait mode (pauses until note is hit), hit detection, scoring
- `src/render/Renderer.ts` — PixiJS rendering: staff, notes with ledger lines, stems, solfege labels, HUD
- `src/debug/logger.ts` — TSV session logger (timestamp, event, JSON data), downloadable

## Build

```
bun run build   # tsc && vite build
bun run dev     # vite dev server
```

## Key concepts

- Sopilka range starts at C5 (MIDI 72), optionally 2 octaves for C major
- Calibration walks through each scale note in the first octave, measures actual pitch, stores per-MIDI offset
- Per-note offsets are extrapolated to higher octaves by pitch class
- Wait mode pauses scrolling and spawning when the frontmost note reaches the stop line
- LOCK events fire when pitch is stable for 8 consecutive frames within 35 cents
