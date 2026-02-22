import type { MusicEngine, ScaleNote } from "../music/MusicEngine.ts";

export interface Monster {
  id: number;
  scaleNote: ScaleNote;
  x: number;
  y: number;
  speed: number;
  alive: boolean;
  deathTime: number;
  spawnTime: number;
}

export interface Projectile {
  id: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  startTime: number;
  duration: number;
}

const BASE_SPEED = 30;
const SPEED_PER_KILL = 2;
const MAX_SPEED = 120;
const BASE_SPAWN_INTERVAL = 2500;
const SPAWN_INTERVAL_PER_KILL = 30;
const MIN_SPAWN_INTERVAL = 800;
const KILL_RADIUS = 40;
const DEATH_LINGER_MS = 400;
const PROJECTILE_DURATION_MS = 300;

export class BattleEngine {
  private _monsters: Monster[] = [];
  private _projectiles: Projectile[] = [];
  private nextId = 0;
  private _score = 0;
  private _combo = 0;
  private _lives = 3;
  private _gameOver = false;
  private _kills = 0;
  private lastSpawn = 0;
  private music: MusicEngine;
  private _playerX = 400;
  private _playerY = 300;
  private _gameWidth = 800;

  constructor(music: MusicEngine) {
    this.music = music;
  }

  get monsters(): readonly Monster[] {
    return this._monsters;
  }

  get projectiles(): readonly Projectile[] {
    return this._projectiles;
  }

  get currentScore(): number {
    return this._score;
  }

  get currentCombo(): number {
    return this._combo;
  }

  get lives(): number {
    return this._lives;
  }

  get gameOver(): boolean {
    return this._gameOver;
  }

  get playerX(): number {
    return this._playerX;
  }

  get playerY(): number {
    return this._playerY;
  }

  setDimensions(w: number, h: number): void {
    this._gameWidth = w;
    this._playerX = w / 2;
    this._playerY = h - 80;
  }

  private get currentSpeed(): number {
    return Math.min(BASE_SPEED + this._kills * SPEED_PER_KILL, MAX_SPEED);
  }

  private get spawnInterval(): number {
    return Math.max(BASE_SPAWN_INTERVAL - this._kills * SPAWN_INTERVAL_PER_KILL, MIN_SPAWN_INTERVAL);
  }

  update(dt: number, nowMs: number): void {
    if (this._gameOver) return;

    // Spawn logic
    const aliveCount = this._monsters.filter((m) => m.alive).length;
    const shouldSpawn = aliveCount === 0 || nowMs - this.lastSpawn > this.spawnInterval;
    if (this.music.notes.length > 0 && shouldSpawn) {
      this.spawnMonster(nowMs);
      this.lastSpawn = nowMs;
    }

    // Move alive monsters toward player
    for (const m of this._monsters) {
      if (!m.alive) continue;
      const dx = this._playerX - m.x;
      const dy = this._playerY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < KILL_RADIUS) {
        // Monster reached player
        m.alive = false;
        m.deathTime = nowMs;
        this._lives--;
        this._combo = 0;
        if (this._lives <= 0) {
          this._gameOver = true;
        }
        continue;
      }
      const nx = dx / dist;
      const ny = dy / dist;
      m.x += nx * m.speed * dt;
      m.y += ny * m.speed * dt;
    }

    // Cleanup dead monsters and expired projectiles
    this._monsters = this._monsters.filter(
      (m) => m.alive || nowMs - m.deathTime < DEATH_LINGER_MS
    );
    this._projectiles = this._projectiles.filter(
      (p) => nowMs - p.startTime < p.duration + 100
    );
  }

  private spawnMonster(nowMs: number): void {
    const scaleNote = this.music.randomNote();
    // Spawn at edges — random side
    const side = Math.random();
    let x: number, y: number;
    if (side < 0.25) {
      // left
      x = -30;
      y = this._playerY - 50 + Math.random() * 100;
    } else if (side < 0.5) {
      // right
      x = this._gameWidth + 30;
      y = this._playerY - 50 + Math.random() * 100;
    } else if (side < 0.75) {
      // top-left
      x = Math.random() * this._gameWidth * 0.3;
      y = -30;
    } else {
      // top-right
      x = this._gameWidth * 0.7 + Math.random() * this._gameWidth * 0.3;
      y = -30;
    }

    this._monsters.push({
      id: this.nextId++,
      scaleNote,
      x,
      y,
      speed: this.currentSpeed,
      alive: true,
      deathTime: 0,
      spawnTime: nowMs,
    });
  }

  tryHit(midi: number, nowMs: number): Monster | null {
    if (this._gameOver) return null;

    // Find closest alive monster matching this MIDI
    let best: Monster | null = null;
    let bestDist = Infinity;
    for (const m of this._monsters) {
      if (!m.alive || m.scaleNote.midi !== midi) continue;
      const dx = this._playerX - m.x;
      const dy = this._playerY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }

    if (best) {
      best.alive = false;
      best.deathTime = nowMs;
      this._kills++;
      this._combo++;
      this._score += 100 * Math.min(this._combo, 10);

      // Create projectile
      this._projectiles.push({
        id: this.nextId++,
        fromX: this._playerX,
        fromY: this._playerY - 40,
        toX: best.x,
        toY: best.y,
        startTime: nowMs,
        duration: PROJECTILE_DURATION_MS,
      });
    }
    return best;
  }

  reset(): void {
    this._monsters = [];
    this._projectiles = [];
    this._score = 0;
    this._combo = 0;
    this._lives = 3;
    this._gameOver = false;
    this._kills = 0;
    this.nextId = 0;
    this.lastSpawn = 0;
  }
}
