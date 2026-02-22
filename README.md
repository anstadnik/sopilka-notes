# Sopilka Notes
[![Deploy to GitHub Pages](https://github.com/anstadnik/sopilka-notes/actions/workflows/deploy.yml/badge.svg)](https://github.com/anstadnik/sopilka-notes/actions/workflows/deploy.yml)

A browser-based practice game for the [sopilka](https://en.wikipedia.org/wiki/Sopilka) (Ukrainian flute). Play notes into your microphone to hit targets — in sheet music mode or monster defense mode.

## How to play

1. Select key, mode, and game type
2. Calibrate by playing each note of the scale when prompted
3. Play!

### Sheet Music mode
Notes scroll across a staff from right to left. Play the correct note on your sopilka to hit each one. Supports wait mode (pauses until you play) and scroll mode (notes keep moving).

### Monster Defense mode
Monsters approach your character from all directions. Each monster carries a mini staff showing which note kills it. Play the note to fire a projectile. You have 3 lives — don't let them reach you! Monsters speed up as your score grows.

## Setup

```
bun install
bun run dev
```

Requires a microphone. Works best in Chrome/Edge (Web Audio API + getUserMedia).

## Build

```
bun run build
bun run preview
```

## Tech stack

- TypeScript + Vite
- PixiJS (rendering)
- pitchy (pitch detection)
- @tonaljs/tonal (music theory)

## License

Sprites from [OpenGameArt.org](https://opengameart.org) (CC0) where used.
