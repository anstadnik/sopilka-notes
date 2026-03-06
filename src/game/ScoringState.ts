/**
 * Shared scoring, combo, milestone, lives, and game-over state
 * used by all three game engines.
 */
export class ScoringState {
  score = 0;
  combo = 0;
  maxCombo = 0;
  lives = 3;
  gameOver = false;
  totalHit = 0;
  totalMissed = 0;
  lastMilestone = 0;
  lastMilestoneTime = 0;
  lastWrongTime = 0;
  sessionDone = false;

  /** Combo multiplier capped at 10. */
  get comboMultiplier(): number {
    return Math.min(this.combo, 10);
  }

  /**
   * Register a successful hit.
   * @param basePoints — base score per hit (default 100)
   * @returns the points awarded
   */
  addHit(basePoints = 100): number {
    this.combo++;
    this.totalHit++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const points = basePoints * this.comboMultiplier;
    this.score += points;
    if (this.combo > 0 && this.combo % 5 === 0) {
      this.lastMilestone = this.combo;
      this.lastMilestoneTime = performance.now();
    }
    return points;
  }

  /** Register a miss (note scrolled off or timed out). */
  addMiss(): void {
    this.totalMissed++;
    this.resetCombo();
  }

  /** Penalize: lose a life, reset combo, and possibly trigger game over. */
  penalize(nowMs: number): void {
    this.lastWrongTime = nowMs;
    this.lives--;
    this.resetCombo();
    if (this.lives <= 0) {
      this.gameOver = true;
    }
  }

  resetCombo(): void {
    this.combo = 0;
  }

  /** Reset all scoring state to defaults. */
  reset(): void {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.lives = 3;
    this.gameOver = false;
    this.totalHit = 0;
    this.totalMissed = 0;
    this.lastMilestone = 0;
    this.lastMilestoneTime = 0;
    this.lastWrongTime = 0;
    this.sessionDone = false;
  }
}
