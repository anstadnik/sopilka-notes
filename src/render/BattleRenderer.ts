import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { BattleEngine, Monster } from "../game/BattleEngine.ts";
import type { PitchResult } from "../audio/PitchEngine.ts";
import { getFingering } from "../music/fingerings.ts";
import { drawFingering } from "./fingeringDiagram.ts";

// Mini staff constants (smaller version for monster labels)
const MINI_STAFF_LINE_GAP = 6;
const MINI_STAFF_LINES = 5;
const MINI_STAFF_WIDTH = 50;
const MINI_NOTE_RADIUS = 4;
const MINI_STAFF_HEIGHT = (MINI_STAFF_LINES - 1) * MINI_STAFF_LINE_GAP;

const MONSTER_RADIUS = 18;

export class BattleRenderer {
  private app: Application;
  private worldGraphics!: Graphics;
  private monsterGraphics!: Graphics;
  private projectileGraphics!: Graphics;
  private playerGraphics!: Graphics;
  private fingeringGraphics!: Graphics;
  private hudContainer!: Container;

  private scoreText!: Text;
  private comboText!: Text;
  private livesText!: Text;
  private detectedText!: Text;
  private centsText!: Text;
  private gameOverContainer!: Container;
  private gameOverScoreText!: Text;
  private goBackBtn!: HTMLButtonElement;

  private _showLabels = true;
  private _showFingering = false;
  private _onGoBack: (() => void) | null = null;

  constructor() {
    this.app = new Application();
  }

  set showLabels(v: boolean) {
    this._showLabels = v;
  }

  set showFingering(v: boolean) {
    this._showFingering = v;
  }

  set onGoBack(cb: (() => void) | null) {
    this._onGoBack = cb;
  }

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: container,
      background: 0x0d0d1a,
      antialias: true,
    });
    container.appendChild(this.app.canvas);

    this.worldGraphics = new Graphics();
    this.monsterGraphics = new Graphics();
    this.projectileGraphics = new Graphics();
    this.playerGraphics = new Graphics();
    this.fingeringGraphics = new Graphics();
    this.hudContainer = new Container();

    this.app.stage.addChild(this.worldGraphics);
    this.app.stage.addChild(this.monsterGraphics);
    this.app.stage.addChild(this.projectileGraphics);
    this.app.stage.addChild(this.playerGraphics);
    this.app.stage.addChild(this.fingeringGraphics);
    this.app.stage.addChild(this.hudContainer);

    const scoreStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 22,
      fill: 0xffdd57,
      fontWeight: "bold",
    });
    const smallStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 14,
      fill: 0xaaaaaa,
    });

    this.scoreText = new Text({ text: "Score: 0", style: scoreStyle });
    this.scoreText.anchor.set(1, 0);
    this.scoreText.x = this.app.screen.width - 10;
    this.scoreText.y = 10;

    this.comboText = new Text({ text: "", style: new TextStyle({
      fontFamily: "monospace",
      fontSize: 16,
      fill: 0xff8855,
    }) });
    this.comboText.anchor.set(1, 0);
    this.comboText.x = this.app.screen.width - 10;
    this.comboText.y = 38;

    this.livesText = new Text({ text: "♥♥♥", style: new TextStyle({
      fontFamily: "sans-serif",
      fontSize: 28,
      fill: 0xff3355,
    }) });
    this.livesText.x = 10;
    this.livesText.y = 8;

    this.detectedText = new Text({ text: "Note: --", style: new TextStyle({
      fontFamily: "monospace",
      fontSize: 16,
      fill: 0xffffff,
    }) });
    this.detectedText.x = 10;
    this.detectedText.y = this.app.screen.height - 40;

    this.centsText = new Text({ text: "Cents: --", style: smallStyle });
    this.centsText.x = 10;
    this.centsText.y = this.app.screen.height - 20;

    this.hudContainer.addChild(this.scoreText);
    this.hudContainer.addChild(this.comboText);
    this.hudContainer.addChild(this.livesText);
    this.hudContainer.addChild(this.detectedText);
    this.hudContainer.addChild(this.centsText);

    // Game over overlay (hidden initially)
    this.gameOverContainer = new Container();
    this.gameOverContainer.visible = false;

    const goText = new Text({ text: "GAME OVER", style: new TextStyle({
      fontFamily: "monospace",
      fontSize: 48,
      fill: 0xff3355,
      fontWeight: "bold",
    }) });
    goText.anchor.set(0.5);
    goText.x = this.app.screen.width / 2;
    goText.y = this.app.screen.height / 2 - 40;

    this.gameOverScoreText = new Text({ text: "", style: new TextStyle({
      fontFamily: "monospace",
      fontSize: 24,
      fill: 0xffdd57,
    }) });
    this.gameOverScoreText.anchor.set(0.5);
    this.gameOverScoreText.x = this.app.screen.width / 2;
    this.gameOverScoreText.y = this.app.screen.height / 2 + 20;

    this.gameOverContainer.addChild(goText);
    this.gameOverContainer.addChild(this.gameOverScoreText);
    this.app.stage.addChild(this.gameOverContainer);

    // HTML "Go Back" button overlaid on canvas
    this.goBackBtn = document.createElement("button");
    this.goBackBtn.textContent = "Go Back";
    this.goBackBtn.className = "game-btn game-over-btn";
    this.goBackBtn.style.display = "none";
    container.appendChild(this.goBackBtn);
    this.goBackBtn.addEventListener("click", () => this._onGoBack?.());
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  render(
    battle: BattleEngine,
    pitchResult: PitchResult | null,
    _lockedNote: unknown,
    solfegeLookup?: (midi: number) => string | undefined,
  ): void {
    this.drawWorld(battle);
    this.drawPlayer(battle);
    this.drawMonsters(battle, solfegeLookup);
    this.drawProjectiles(battle);
    this.drawFingeringHint(battle);
    this.updateHud(battle, pitchResult, solfegeLookup);
  }

  private drawWorld(battle: BattleEngine): void {
    const g = this.worldGraphics;
    g.clear();
    // Ground line
    const groundY = battle.playerY + 30;
    g.moveTo(0, groundY);
    g.lineTo(this.app.screen.width, groundY);
    g.stroke({ color: 0x333355, width: 2 });
    // Subtle ground fill
    g.rect(0, groundY, this.app.screen.width, this.app.screen.height - groundY);
    g.fill({ color: 0x111122 });
  }

  private drawPlayer(battle: BattleEngine): void {
    const g = this.playerGraphics;
    g.clear();
    const px = battle.playerX;
    const py = battle.playerY;

    // Body (rectangle)
    g.roundRect(px - 12, py - 35, 24, 40, 4);
    g.fill({ color: 0x3366aa });

    // Head
    g.circle(px, py - 48, 14);
    g.fill({ color: 0xffcc88 });

    // Eyes
    g.circle(px - 4, py - 50, 2);
    g.fill({ color: 0x222222 });
    g.circle(px + 4, py - 50, 2);
    g.fill({ color: 0x222222 });

    // Sopilka (diagonal line from mouth area)
    g.moveTo(px + 6, py - 44);
    g.lineTo(px + 35, py - 20);
    g.stroke({ color: 0xcc8844, width: 3 });
    // Sopilka end cap
    g.circle(px + 35, py - 20, 3);
    g.fill({ color: 0xcc8844 });

    // Legs
    g.moveTo(px - 6, py + 5);
    g.lineTo(px - 10, py + 25);
    g.stroke({ color: 0x3366aa, width: 4 });
    g.moveTo(px + 6, py + 5);
    g.lineTo(px + 10, py + 25);
    g.stroke({ color: 0x3366aa, width: 4 });
  }

  private drawMonsters(battle: BattleEngine, solfegeLookup?: (midi: number) => string | undefined): void {
    const g = this.monsterGraphics;
    g.clear();

    for (const m of battle.monsters) {
      if (m.alive) {
        this.drawMonster(g, m, solfegeLookup);
      } else {
        // Death flash — fading out
        const now = performance.now();
        const elapsed = now - m.deathTime;
        const alpha = Math.max(0, 1 - elapsed / 400);
        this.drawMonsterDead(g, m, alpha);
      }
    }
  }

  private drawMonster(g: Graphics, m: Monster, _solfegeLookup?: (midi: number) => string | undefined): void {
    // Body — colored blob
    const hue = (m.scaleNote.midi * 37) % 360;
    const color = this.hslToHex(hue, 60, 45);
    g.circle(m.x, m.y, MONSTER_RADIUS);
    g.fill({ color });

    // Solfege label drawn as part of mini staff if enabled
    void this._showLabels;

    // Dark outline
    g.circle(m.x, m.y, MONSTER_RADIUS);
    g.stroke({ color: 0x000000, width: 2 });

    // Eyes
    g.circle(m.x - 6, m.y - 4, 5);
    g.fill({ color: 0xffffff });
    g.circle(m.x + 6, m.y - 4, 5);
    g.fill({ color: 0xffffff });

    // Pupils — look toward player
    g.circle(m.x - 5, m.y - 4, 2.5);
    g.fill({ color: 0x111111 });
    g.circle(m.x + 7, m.y - 4, 2.5);
    g.fill({ color: 0x111111 });

    // Mouth
    g.moveTo(m.x - 5, m.y + 6);
    g.quadraticCurveTo(m.x, m.y + 12, m.x + 5, m.y + 6);
    g.stroke({ color: 0x111111, width: 1.5 });

    // Mini staff above monster
    const staffTopY = m.y - MONSTER_RADIUS - MINI_STAFF_HEIGHT - 15;
    this.drawMiniStaff(g, m.x, staffTopY, m.scaleNote);
  }

  private drawMonsterDead(g: Graphics, m: Monster, alpha: number): void {
    // Flash white then fade
    g.circle(m.x, m.y, MONSTER_RADIUS * (1 + (1 - alpha) * 0.5));
    g.fill({ color: 0xffff88, alpha: alpha * 0.7 });
  }

  private drawMiniStaff(g: Graphics, cx: number, topY: number, note: { staffPosition: number }): void {
    const halfW = MINI_STAFF_WIDTH / 2;

    // 5 staff lines
    for (let i = 0; i < MINI_STAFF_LINES; i++) {
      const y = topY + i * MINI_STAFF_LINE_GAP;
      g.moveTo(cx - halfW, y);
      g.lineTo(cx + halfW, y);
      g.stroke({ color: 0x666688, width: 1 });
    }

    // Note position
    const bottomLineY = topY + MINI_STAFF_HEIGHT;
    const noteY = bottomLineY - note.staffPosition * (MINI_STAFF_LINE_GAP / 2);

    // Ledger lines
    const bottomPos = 0;
    const topPos = (MINI_STAFF_LINES - 1) * 2;
    if (note.staffPosition < bottomPos) {
      for (let p = bottomPos - 2; p >= note.staffPosition; p -= 2) {
        const ly = bottomLineY - p * (MINI_STAFF_LINE_GAP / 2);
        g.moveTo(cx - MINI_NOTE_RADIUS - 3, ly);
        g.lineTo(cx + MINI_NOTE_RADIUS + 3, ly);
        g.stroke({ color: 0x666688, width: 1 });
      }
    } else if (note.staffPosition > topPos) {
      for (let p = topPos + 2; p <= note.staffPosition; p += 2) {
        const ly = bottomLineY - p * (MINI_STAFF_LINE_GAP / 2);
        g.moveTo(cx - MINI_NOTE_RADIUS - 3, ly);
        g.lineTo(cx + MINI_NOTE_RADIUS + 3, ly);
        g.stroke({ color: 0x666688, width: 1 });
      }
    }

    // Note head
    g.ellipse(cx, noteY, MINI_NOTE_RADIUS, MINI_NOTE_RADIUS * 0.75);
    g.fill({ color: 0xffffff });

    // Stem
    g.moveTo(cx + MINI_NOTE_RADIUS - 1, noteY);
    g.lineTo(cx + MINI_NOTE_RADIUS - 1, noteY - 15);
    g.stroke({ color: 0xffffff, width: 1.5 });
  }

  private drawFingeringHint(battle: BattleEngine): void {
    const fg = this.fingeringGraphics;
    fg.clear();
    if (!this._showFingering) return;

    // Find closest alive monster to the player
    let closest: Monster | null = null;
    let closestDist = Infinity;
    for (const m of battle.monsters) {
      if (!m.alive) continue;
      const dx = battle.playerX - m.x;
      const dy = battle.playerY - m.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < closestDist) {
        closestDist = dist;
        closest = m;
      }
    }

    if (closest) {
      const holes = getFingering(closest.scaleNote.midi);
      if (holes) {
        drawFingering(fg, this.app.screen.width - 60, this.app.screen.height / 2 - 40, holes, 1.5);
      }
    }
  }

  private drawProjectiles(battle: BattleEngine): void {
    const g = this.projectileGraphics;
    g.clear();
    const now = performance.now();

    for (const p of battle.projectiles) {
      const elapsed = now - p.startTime;
      const t = Math.min(elapsed / p.duration, 1);

      // Ease out
      const et = 1 - (1 - t) * (1 - t);
      const x = p.fromX + (p.toX - p.fromX) * et;
      const y = p.fromY + (p.toY - p.fromY) * et;

      if (t < 1) {
        // Fireball glow
        g.circle(x, y, 12);
        g.fill({ color: 0xff6600, alpha: 0.3 });
        g.circle(x, y, 8);
        g.fill({ color: 0xff8800, alpha: 0.6 });
        g.circle(x, y, 4);
        g.fill({ color: 0xffcc00 });

        // Trail
        const prevT = Math.max(0, et - 0.15);
        const tx = p.fromX + (p.toX - p.fromX) * prevT;
        const ty = p.fromY + (p.toY - p.fromY) * prevT;
        g.moveTo(tx, ty);
        g.lineTo(x, y);
        g.stroke({ color: 0xff6600, alpha: 0.4, width: 3 });
      }
    }
  }

  private updateHud(
    battle: BattleEngine,
    pitchResult: PitchResult | null,
    solfegeLookup?: (midi: number) => string | undefined,
  ): void {
    this.scoreText.text = `Score: ${battle.currentScore}`;
    this.scoreText.x = this.app.screen.width - 10;
    this.comboText.x = this.app.screen.width - 10;

    if (battle.currentCombo > 1) {
      this.comboText.text = `x${battle.currentCombo} combo`;
    } else {
      this.comboText.text = "";
    }

    this.livesText.text = "♥".repeat(battle.lives) + "♡".repeat(Math.max(0, 3 - battle.lives));

    if (pitchResult) {
      const displayName = solfegeLookup?.(pitchResult.midiNearest) ?? pitchResult.noteName;
      this.detectedText.text = `Note: ${displayName}`;
      this.centsText.text = `Cents: ${pitchResult.cents > 0 ? "+" : ""}${pitchResult.cents.toFixed(0)}`;
    } else {
      this.detectedText.text = "Note: --";
      this.centsText.text = "Cents: --";
    }

    this.detectedText.y = this.app.screen.height - 40;
    this.centsText.y = this.app.screen.height - 20;

    // Game over
    this.gameOverContainer.visible = battle.gameOver;
    this.goBackBtn.style.display = battle.gameOver ? "" : "none";
    if (battle.gameOver) {
      this.gameOverScoreText.text = `Final Score: ${battle.currentScore}`;
    }
  }

  private hslToHex(h: number, s: number, l: number): number {
    s /= 100;
    l /= 100;
    const a = s * Math.min(l, 1 - l);
    const f = (n: number) => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color);
    };
    return (f(0) << 16) | (f(8) << 8) | f(4);
  }

  getTicker() {
    return this.app.ticker;
  }
}
