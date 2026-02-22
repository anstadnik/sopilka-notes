# Sopilka Notes

A sopilka (Ukrainian flute) practice game built with TypeScript, Vite, and PixiJS.

## Build & Run

Uses **bun** as the package manager and script runner.

```
bun install         # install dependencies
bun run dev         # vite dev server
bun run build       # tsc && vite build
bun run tsc --noEmit  # type-check only
```

Deployed to GitHub Pages at `/sopilka-notes/` base path (configured in `vite.config.ts`).

## Dependencies

- **pixi.js** ^8.16.0 — 2D rendering (staff, notes, monsters, HUD)
- **pitchy** ^4.1.0 — Pitch detection from microphone audio
- **@tonaljs/tonal** ^4.10.0 — Music theory (scales, note names, MIDI)
- **firebase** ^12.9.0 — Leaderboard backend (optional, degrades gracefully)
- **vite** ^8.0.0-beta.13 — Bundler and dev server
- **typescript** ~5.9.3

## Architecture

### Entry point

`src/main.ts` — Builds the start screen UI, handles settings (key, mode, game mode, calibration, "all notes" checkbox for C major), initializes audio/pitch/music engines, orchestrates calibration flow, launches the selected game mode, and manages pause/exit.

### Audio pipeline

`src/audio/AudioEngine.ts` → `src/audio/PitchEngine.ts`

- **AudioEngine** — Requests microphone via `getUserMedia`, pipes through `AnalyserNode` (FFT 2048), exposes `getBuffer()` returning a `Float32Array` of time-domain samples.
- **PitchEngine** — Runs pitchy on each frame. Tracks a history of recent MIDI values and "locks" a note when the same nearest-MIDI appears for 8 consecutive frames within 35 cents. Fires an `onLock` callback used by game engines for hit detection. Also handles per-note calibration: collects 15 samples per scale note, computes pitch offsets, and extrapolates by pitch class to higher octaves.

### Music theory

`src/music/MusicEngine.ts`

Wraps `@tonaljs/tonal`. Given a tonic, mode, and MIDI range, builds an array of `ScaleNote` objects containing MIDI number, enharmonic name, fixed-do solfege (with ♭/♯ accidentals), and staff position (diatonic offset from E5 = bottom staff line). Provides `randomNote()` for game engines and `noteForMidi()` for renderers.

`src/music/fingerings.ts` — Static `ReadonlyMap<number, readonly number[]>` mapping MIDI 60–83 to 10-element arrays (2 back + 8 front hole states: 1=closed, 0=open, 0.5=half).

### Game engines

Both engines take `MusicEngine` in their constructor and call `randomNote()` to spawn targets.

`src/game/GameEngine.ts` — **Sheet Music mode**. Spawns `GameNote` objects every 1500ms at the right edge, scrolls left at 150px/s. **Wait mode** pauses scrolling when the frontmost note reaches x=120. `tryHit(midi)` matches the leftmost unhit note by MIDI number; score = 100 × min(combo, 10).

`src/game/BattleEngine.ts` — **Monster Defense mode**. Spawns `Monster` objects from random edges moving toward the player (bottom-center). Difficulty scales with kills: speed increases from 30 to 120 px/s, spawn interval decreases from 2500ms to 800ms. `tryHit(midi, now)` targets the closest matching monster and spawns a 300ms `Projectile`. 3 lives; game over at 0.

### Renderers

Both use pixi.js `Application` and layered `Graphics` objects.

`src/render/Renderer.ts` — **Sheet Music mode**. Draws 5-line treble staff, note heads with stems, ledger lines for out-of-staff notes. Hit notes flash green and fade. HUD shows detected pitch, cents deviation, confidence, score, and combo. Optional solfege labels and fingering diagram hint (rightmost unhit note).

`src/render/BattleRenderer.ts` — **Monster Defense mode**. Draws player (stick figure with sopilka), colored monsters (hue from MIDI), mini-staves above each monster, projectile fireballs with glow trails, death flash. HUD shows score, combo multiplier, lives as hearts (♥/♡). Game-over overlay with score and "Back to Menu" button.

`src/render/fingeringDiagram.ts` — Shared function `drawFingering(graphics, cx, topY, holes, scale)` drawing a sopilka diagram with back (left) and front (right) hole views. Used by both renderers for fingering hints.

### Supporting modules

`src/leaderboard.ts` — Firebase Firestore integration. `addScore(name, score, mode, key)` writes to the `leaderboard` collection; `getLeaderboard(key)` fetches top 20. Player name persisted in localStorage. Firebase config from `VITE_*` env vars; no-ops if unconfigured.

`src/debug/logger.ts` — In-memory TSV logger (`timestamp\tevent\tJSON`). Events: `SESSION_START`, `CONFIG`, `CAL_NOTE`, `CAL_DONE`, `LOCK`, `PITCH`.

### Data flow

```
Sopilka → Mic → AudioEngine.getBuffer()
  → PitchEngine.update() → detect freq → compute MIDI → check lock (8 frames, 35¢)
    → onLock callback → GameEngine.tryHit() / BattleEngine.tryHit()
      → Renderer.render() / BattleRenderer.render() → screen
```

## Key concepts

- Sopilka physical range starts at C5 (MIDI 72). For non-C tonics, lowMidi shifts up by the tonic's semitone offset.
- For C major, an "All notes" checkbox extends the range to 2 octaves (C5–C7); other keys always use 1 octave (8 scale notes, tonic to tonic).
- Calibration walks through the first 8 scale notes, measures actual pitch, stores per-MIDI offsets extrapolated by pitch class.
- Wait mode (sheet music) pauses scrolling and spawning when the frontmost note reaches the stop line.
- LOCK events fire when pitch is stable for 8 consecutive frames within 35 cents of a MIDI note.
