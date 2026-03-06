import type { MusicEngine, ScaleNote } from "../music/MusicEngine.ts";
import { ScoringState } from "./ScoringState";

export interface GameNote {
  id: number;
  scaleNote: ScaleNote;
  x: number;
  hit: boolean;
  hitTime: number;
  spawnTime: number;
  missed: boolean;
  missedTime: number;
  wrongFlashTime: number;
}

const WAIT_STOP_X = 120;
const SPAWN_INTERVAL_MS = 1500;
const HIT_LINGER_MS = 400;
const MISS_LINGER_MS = 600;
const HIT_GRACE_MS = 300; // suppress wrong flashes shortly after a successful hit

export class GameEngine {
  private notes: GameNote[] = [];
  private nextId = 0;
  private readonly scoring = new ScoringState();
  private lastSpawn = 0;
  private speed = 150; // pixels per second
  private music: MusicEngine;
  private _gameWidth = 800;
  private _waitMode = true;
  private _totalToSpawn = 0; // 0 = endless
  private _totalSpawned = 0;
  private _lastHitTime = 0;
  private _cleanMode = false;

  constructor(music: MusicEngine) {
    this.music = music;
  }

  get gameNotes(): readonly GameNote[] {
    return this.notes;
  }

  get currentScore(): number {
    return this.scoring.score;
  }

  get currentCombo(): number {
    return this.scoring.combo;
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

  setSessionLength(n: number): void {
    this._totalToSpawn = n;
  }

  get sessionDone(): boolean {
    return this.scoring.sessionDone;
  }

  get totalHit(): number {
    return this.scoring.totalHit;
  }

  get totalMissed(): number {
    return this.scoring.totalMissed;
  }

  get maxCombo(): number {
    return this.scoring.maxCombo;
  }

  get totalSpawned(): number {
    return this._totalSpawned;
  }

  get lastMilestone(): number {
    return this.scoring.lastMilestone;
  }

  get lastMilestoneTime(): number {
    return this.scoring.lastMilestoneTime;
  }

  get cleanMode(): boolean {
    return this._cleanMode;
  }

  setCleanMode(on: boolean): void {
    this._cleanMode = on;
    if (on && this.scoring.gameOver) {
      // Reset lives when turning clean mode on after game over
      this.scoring.lives = 3;
      this.scoring.gameOver = false;
    }
  }

  get lives(): number {
    return this.scoring.lives;
  }

  get gameOver(): boolean {
    return this.scoring.gameOver;
  }

  get lastWrongTime(): number {
    return this.scoring.lastWrongTime;
  }

  update(dt: number, nowMs: number): void {
    if (this.scoring.gameOver) return;

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
      if (n.missed && nowMs - n.missedTime > MISS_LINGER_MS) return false;
      if (!this._waitMode && !n.hit && !n.missed && n.x < -50) {
        n.missed = true;
        n.missedTime = nowMs;
        this.scoring.addMiss();
        return true; // keep for miss animation
      }
      return true;
    });

    // Check session completion
    if (this._totalToSpawn > 0 && this._totalSpawned >= this._totalToSpawn && this.notes.length === 0) {
      this.scoring.sessionDone = true;
    }
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
    if (this._totalToSpawn > 0 && this._totalSpawned >= this._totalToSpawn) return;
    const scaleNote = this.music.randomNote();
    this.notes.push({
      id: this.nextId++,
      scaleNote,
      x: this._gameWidth + 50,
      hit: false,
      hitTime: 0,
      spawnTime: nowMs,
      missed: false,
      missedTime: 0,
      wrongFlashTime: 0,
    });
    this._totalSpawned++;
  }

  triggerWrongFlash(): void {
    if (this.scoring.gameOver) return;
    const now = performance.now();
    // Grace period after a successful hit — don't punish residual pitch lock
    if (now - this._lastHitTime < HIT_GRACE_MS) return;

    const front = this.frontNote();
    if (front) {
      front.wrongFlashTime = now;
      this.scoring.lastWrongTime = now;
    }
    if (this._cleanMode) {
      this.scoring.penalize(now);
    }
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
      this._lastHitTime = best.hitTime;
      this.scoring.addHit();
    }
    return best;
  }

  reset(): void {
    this.notes = [];
    this.nextId = 0;
    this.lastSpawn = 0;
    this._totalToSpawn = 0;
    this._totalSpawned = 0;
    this._lastHitTime = 0;
    this._cleanMode = false;
    this.scoring.reset();
  }
}
