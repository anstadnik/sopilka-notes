import type { MusicEngine, ScaleNote } from "../music/MusicEngine.ts";
import { ScoringState } from "./ScoringState";

export type NoteDuration = "whole" | "half" | "quarter" | "eighth" | "sixteenth";
export type Complexity = "easy" | "medium" | "hard";
export type Tolerance = "tight" | "normal" | "loose";

export interface RhythmNote {
  id: number;
  scaleNote: ScaleNote;
  duration: NoteDuration;
  durationBeats: number;
  x: number;
  hit: boolean;
  hitTime: number;
  missed: boolean;
  missedTime: number;
  wrongFlashTime: number;
  spawnTime: number;
  holdStartTime: number;
  holdAccumulated: number; // ms accumulated so far
  holdProgress: number; // 0–1
  holding: boolean;
}

const DURATION_BEATS: Record<NoteDuration, number> = {
  whole: 4,
  half: 2,
  quarter: 1,
  eighth: 0.5,
  sixteenth: 0.25,
};

const COMPLEXITY_DURATIONS: Record<Complexity, NoteDuration[]> = {
  easy: ["whole", "half"],
  medium: ["whole", "half", "quarter"],
  hard: ["half", "quarter", "eighth", "sixteenth"],
};

// Weight shorter notes less heavily so the mix feels natural
const DURATION_WEIGHTS: Record<NoteDuration, number> = {
  whole: 1,
  half: 2,
  quarter: 3,
  eighth: 2,
  sixteenth: 1,
};

const TOLERANCE_FACTOR: Record<Tolerance, number> = {
  tight: 0.15,
  normal: 0.25,
  loose: 0.40,
};

const STOP_X = 120;
const HIT_LINGER_MS = 400;
const MISS_LINGER_MS = 600;
const NOTE_SPACING = 60;
const SPEED = 150; // pixels per second for queued notes scrolling in

export class RhythmEngine {
  private notes: RhythmNote[] = [];
  private nextId = 0;
  private readonly scoring = new ScoringState();
  private music: MusicEngine;
  private _gameWidth = 800;
  private _bpm = 80;
  private _complexity: Complexity = "easy";
  private _tolerance: Tolerance = "normal";
  private _strict = false;
  private _totalToSpawn = 0;
  private _totalSpawned = 0;
  private _lastNoteIndex: number | undefined = undefined;
  // Track wrong-note penalty: only penalize once per "wrong note event"
  private _wrongNotePending = false;

  constructor(music: MusicEngine) {
    this.music = music;
  }

  get rhythmNotes(): readonly RhythmNote[] {
    return this.notes;
  }

  get currentScore(): number {
    return this.scoring.score;
  }

  get currentCombo(): number {
    return this.scoring.combo;
  }

  get bpm(): number {
    return this._bpm;
  }

  get complexity(): Complexity {
    return this._complexity;
  }

  get toleranceName(): Tolerance {
    return this._tolerance;
  }

  get strict(): boolean {
    return this._strict;
  }

  get lives(): number {
    return this.scoring.lives;
  }

  get gameOver(): boolean {
    return this.scoring.gameOver;
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

  get lastWrongTime(): number {
    return this.scoring.lastWrongTime;
  }

  setBpm(bpm: number): void {
    this._bpm = bpm;
  }

  setComplexity(c: Complexity): void {
    this._complexity = c;
  }

  setTolerance(t: Tolerance): void {
    this._tolerance = t;
  }

  setStrict(on: boolean): void {
    this._strict = on;
  }

  setGameWidth(w: number): void {
    this._gameWidth = w;
  }

  setSessionLength(n: number): void {
    this._totalToSpawn = n;
  }

  /** Expected hold duration in ms for a given number of beats */
  beatDurationMs(): number {
    return 60000 / this._bpm;
  }

  private toleranceFactor(): number {
    return TOLERANCE_FACTOR[this._tolerance];
  }

  update(dt: number, nowMs: number, lockedMidi: number | null): void {
    if (this.scoring.gameOver) return;

    // Ensure we always have notes queued up (up to 5 ahead)
    while (this.notes.filter((n) => !n.hit && !n.missed).length < 5) {
      if (this._totalToSpawn > 0 && this._totalSpawned >= this._totalToSpawn) break;
      this.spawnNote(nowMs);
    }

    // Move notes toward stop line
    const front = this.frontNote();
    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      if (note === front) {
        // Front note clamps at stop line
        if (note.x > STOP_X) {
          note.x -= SPEED * dt;
          if (note.x < STOP_X) note.x = STOP_X;
        }
      } else {
        note.x -= SPEED * dt;
      }
    }

    // Clamp queued notes so they don't overlap
    let stopAt = STOP_X;
    for (const note of this.notes) {
      if (note.hit || note.missed) continue;
      if (note.x < stopAt) note.x = stopAt;
      stopAt = note.x + NOTE_SPACING;
    }

    // Duration checking for front note
    if (front && front.x <= STOP_X) {
      this.checkDuration(front, nowMs, lockedMidi);
    }

    // Remove finished notes
    this.notes = this.notes.filter((n) => {
      if (n.hit && nowMs - n.hitTime > HIT_LINGER_MS) return false;
      if (n.missed && nowMs - n.missedTime > MISS_LINGER_MS) return false;
      return true;
    });

    // Check session completion
    if (this._totalToSpawn > 0 && this._totalSpawned >= this._totalToSpawn && this.notes.length === 0) {
      this.scoring.sessionDone = true;
    }
  }

  private checkDuration(note: RhythmNote, nowMs: number, lockedMidi: number | null): void {
    const expectedMs = note.durationBeats * this.beatDurationMs();
    const tolerance = expectedMs * this.toleranceFactor();

    if (lockedMidi === note.scaleNote.midi) {
      // Correct pitch is being played
      if (!note.holding) {
        // Start holding
        note.holding = true;
        note.holdStartTime = nowMs;
        this._wrongNotePending = false;
      }
      // Accumulate hold time
      const currentHold = note.holdAccumulated + (nowMs - note.holdStartTime);
      note.holdProgress = Math.min(1, currentHold / expectedMs);

      // Check if held long enough
      if (currentHold >= expectedMs - tolerance) {
        this.markHit(note, nowMs);
      }
    } else {
      // Not playing the correct pitch
      if (note.holding) {
        // Player released or switched notes
        note.holdAccumulated += nowMs - note.holdStartTime;
        note.holding = false;

        // Check if they held long enough before releasing
        if (note.holdAccumulated >= expectedMs - tolerance) {
          this.markHit(note, nowMs);
          return;
        }

        // If they had started and stopped, check if it's a "too early" release
        if (note.holdAccumulated > 0 && note.holdAccumulated < expectedMs - tolerance) {
          // Released too early — in strict mode this costs a life
          if (this._strict && !this._wrongNotePending) {
            this._wrongNotePending = true;
            this.penalizeNote(note, nowMs);
          }
        }
      } else if (lockedMidi !== null && !this._wrongNotePending) {
        // Playing wrong pitch while front note is at stop line
        this._wrongNotePending = true;
        note.wrongFlashTime = nowMs;
        this.scoring.lastWrongTime = nowMs;
        if (this._strict) {
          this.penalizeNote(note, nowMs);
        }
      }
    }
  }

  private markHit(note: RhythmNote, nowMs: number): void {
    note.hit = true;
    note.hitTime = nowMs;
    note.holding = false;
    note.holdProgress = 1;
    // Score: base 100 × combo multiplier × duration bonus
    const durationBonus = Math.max(1, Math.round(note.durationBeats * 2));
    this.scoring.addHit(100 * durationBonus);
    this._wrongNotePending = false;
  }

  private penalizeNote(note: RhythmNote, nowMs: number): void {
    note.wrongFlashTime = nowMs;
    this.scoring.penalize(nowMs);
  }

  /** Skip the current note (e.g., timeout or player explicitly gives up) */
  missNote(note: RhythmNote, nowMs: number): void {
    if (note.hit || note.missed) return;
    note.missed = true;
    note.missedTime = nowMs;
    note.holding = false;
    this.scoring.addMiss();
    this._wrongNotePending = false;
  }

  private frontNote(): RhythmNote | undefined {
    for (const note of this.notes) {
      if (!note.hit && !note.missed) return note;
    }
    return undefined;
  }

  private spawnNote(nowMs: number): void {
    if (this._totalToSpawn > 0 && this._totalSpawned >= this._totalToSpawn) return;

    const { note: scaleNote, index } = this.music.smartRandomNote(this._lastNoteIndex);
    this._lastNoteIndex = index;

    const duration = this.pickDuration();
    const durationBeats = DURATION_BEATS[duration];

    // Position: after the last queued note
    let x = this._gameWidth + 50;
    const lastQueued = [...this.notes].reverse().find((n) => !n.hit && !n.missed);
    if (lastQueued) {
      x = Math.max(x, lastQueued.x + NOTE_SPACING);
    }

    this.notes.push({
      id: this.nextId++,
      scaleNote,
      duration,
      durationBeats,
      x,
      hit: false,
      hitTime: 0,
      missed: false,
      missedTime: 0,
      wrongFlashTime: 0,
      spawnTime: nowMs,
      holdStartTime: 0,
      holdAccumulated: 0,
      holdProgress: 0,
      holding: false,
    });
    this._totalSpawned++;
  }

  private pickDuration(): NoteDuration {
    const available = COMPLEXITY_DURATIONS[this._complexity];
    // Weighted random
    let total = 0;
    for (const d of available) total += DURATION_WEIGHTS[d];
    let r = Math.random() * total;
    for (const d of available) {
      r -= DURATION_WEIGHTS[d];
      if (r <= 0) return d;
    }
    return available[available.length - 1];
  }

  reset(): void {
    this.notes = [];
    this.nextId = 0;
    this._totalToSpawn = 0;
    this._totalSpawned = 0;
    this._lastNoteIndex = undefined;
    this._wrongNotePending = false;
    this.scoring.reset();
    this.music.resetVisitCounts();
  }
}
