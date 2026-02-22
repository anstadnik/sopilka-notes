import type { MusicEngine, ScaleNote } from "../music/MusicEngine.ts";

export interface GameNote {
  id: number;
  scaleNote: ScaleNote;
  x: number;
  hit: boolean;
  hitTime: number;
  spawnTime: number;
}

const WAIT_STOP_X = 120;
const SPAWN_INTERVAL_MS = 1500;
const HIT_LINGER_MS = 400;

export class GameEngine {
  private notes: GameNote[] = [];
  private nextId = 0;
  private score = 0;
  private combo = 0;
  private lastSpawn = 0;
  private speed = 150; // pixels per second
  private music: MusicEngine;
  private _gameWidth = 800;
  private _waitMode = true;

  constructor(music: MusicEngine) {
    this.music = music;
  }

  get gameNotes(): readonly GameNote[] {
    return this.notes;
  }

  get currentScore(): number {
    return this.score;
  }

  get currentCombo(): number {
    return this.combo;
  }

  get waitMode(): boolean {
    return this._waitMode;
  }

  setWaitMode(wait: boolean): void {
    this._waitMode = wait;
  }

  setGameWidth(w: number): void {
    this._gameWidth = w;
  }

  update(dt: number, nowMs: number): void {
    // In wait mode, pause scrolling if the leftmost unhit note has reached the stop line
    const paused = this._waitMode && this.isWaiting();

    // Spawn new notes (but not while paused — prevents stacking)
    if (this.music.notes.length > 0 && !paused && nowMs - this.lastSpawn > SPAWN_INTERVAL_MS) {
      this.spawnNote(nowMs);
      this.lastSpawn = nowMs;
    }

    if (!paused) {
      for (const note of this.notes) {
        note.x -= this.speed * dt;
      }
    }

    // In wait mode, clamp unhit notes so they don't pile up past the stop line
    if (this._waitMode) {
      let stopX = WAIT_STOP_X;
      for (const note of this.notes) {
        if (note.hit) continue;
        if (note.x < stopX) note.x = stopX;
        stopX = note.x + 60; // minimum spacing between notes
      }
    }

    // Remove hit notes after linger period, and notes that scrolled off screen
    this.notes = this.notes.filter((n) => {
      if (n.hit && nowMs - n.hitTime > HIT_LINGER_MS) return false;
      if (!this._waitMode && n.x < -50) return false;
      return true;
    });
  }

  /** True if we're in wait mode and the frontmost note is waiting to be played */
  private isWaiting(): boolean {
    const front = this.frontNote();
    return front !== undefined && front.x <= WAIT_STOP_X;
  }

  private frontNote(): GameNote | undefined {
    for (const note of this.notes) {
      if (!note.hit) return note;
    }
    return undefined;
  }

  private spawnNote(nowMs: number): void {
    const scaleNote = this.music.randomNote();
    this.notes.push({
      id: this.nextId++,
      scaleNote,
      x: this._gameWidth + 50,
      hit: false,
      hitTime: 0,
      spawnTime: nowMs,
    });
  }

  tryHit(midi: number): GameNote | null {
    // Find the leftmost unhit note that matches this MIDI (no distance restriction)
    let best: GameNote | null = null;
    for (const note of this.notes) {
      if (!note.hit && note.scaleNote.midi === midi) {
        if (best === null || note.x < best.x) {
          best = note;
        }
      }
    }
    if (best) {
      best.hit = true;
      best.hitTime = performance.now();
      this.combo++;
      this.score += 100 * Math.min(this.combo, 10);
    }
    return best;
  }

  reset(): void {
    this.notes = [];
    this.score = 0;
    this.combo = 0;
    this.nextId = 0;
    this.lastSpawn = 0;
  }
}
