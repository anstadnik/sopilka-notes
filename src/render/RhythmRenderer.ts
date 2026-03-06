import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { RhythmEngine, RhythmNote, NoteDuration } from "../game/RhythmEngine.ts";
import type { PitchResult, LockedNote } from "../audio/PitchEngine.ts";
import type { Metronome } from "../audio/Metronome.ts";
import { getFingering } from "../music/fingerings.ts";
import { drawFingering } from "./fingeringDiagram.ts";
import { t } from "../i18n.ts";

const STAFF_TOP = 80;
const STAFF_LINE_GAP = 24;
const STAFF_LINES = 5;
const STAFF_LEFT = 60;
const NOTE_RADIUS = 10;
const STAFF_HEIGHT = (STAFF_LINES - 1) * STAFF_LINE_GAP;

const noteLabelStyle = new TextStyle({
  fontFamily: "monospace",
  fontSize: 11,
  fill: 0xffffff,
});

const accidentalStyle = new TextStyle({
  fontFamily: "serif",
  fontSize: 16,
  fill: 0xffffff,
});

export class RhythmRenderer {
  private app: Application;
  private staffGraphics!: Graphics;
  private notesGraphics!: Graphics;
  private fingeringGraphics!: Graphics;
  private hudGraphics!: Graphics;
  private gaugeGraphics!: Graphics;
  private celebrationGraphics!: Graphics;
  private beatGraphics!: Graphics;
  private progressGraphics!: Graphics;
  private labelsContainer!: Container;
  private labelPool: Text[] = [];
  private accidentalPool: Text[] = [];

  private clefText!: Text;
  private octaveLabel!: Text;
  private detectedText!: Text;
  private centsText!: Text;
  private confidenceText!: Text;
  private scoreText!: Text;
  private comboText!: Text;
  private lockedText!: Text;
  private livesText!: Text;
  private bpmText!: Text;
  private gameOverContainer!: Container;
  private gameOverText!: Text;
  private gameOverScoreText!: Text;

  constructor() {
    this.app = new Application();
  }

  async init(container: HTMLElement): Promise<void> {
    await this.app.init({
      resizeTo: container,
      background: 0x1a1a2e,
      antialias: true,
    });
    container.appendChild(this.app.canvas);

    this.staffGraphics = new Graphics();
    this.notesGraphics = new Graphics();
    this.fingeringGraphics = new Graphics();
    this.hudGraphics = new Graphics();
    this.gaugeGraphics = new Graphics();
    this.celebrationGraphics = new Graphics();
    this.beatGraphics = new Graphics();
    this.progressGraphics = new Graphics();
    this.labelsContainer = new Container();

    this.app.stage.addChild(this.staffGraphics);
    this.app.stage.addChild(this.notesGraphics);
    this.app.stage.addChild(this.progressGraphics);
    this.app.stage.addChild(this.fingeringGraphics);
    this.app.stage.addChild(this.labelsContainer);
    this.app.stage.addChild(this.hudGraphics);
    this.app.stage.addChild(this.gaugeGraphics);
    this.app.stage.addChild(this.celebrationGraphics);
    this.app.stage.addChild(this.beatGraphics);

    this.clefText = new Text({
      text: "\uD834\uDD1E",
      style: new TextStyle({ fontFamily: "serif", fontSize: 48, fill: 0x666688 }),
    });
    this.clefText.x = STAFF_LEFT - 5;
    this.clefText.y = STAFF_TOP - 10;
    this.app.stage.addChild(this.clefText);

    this.octaveLabel = new Text({
      text: "",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 14, fill: 0xaaaaaa }),
    });
    this.octaveLabel.anchor.set(0.5, 0);
    this.octaveLabel.visible = false;
    this.app.stage.addChild(this.octaveLabel);

    const style = new TextStyle({ fontFamily: "monospace", fontSize: 18, fill: 0xffffff });
    const smallStyle = new TextStyle({ fontFamily: "monospace", fontSize: 14, fill: 0xaaaaaa });
    const scoreStyle = new TextStyle({ fontFamily: "monospace", fontSize: 22, fill: 0xffdd57, fontWeight: "bold" });

    this.detectedText = new Text({ text: `${t("note")} --`, style });
    this.detectedText.x = 10;
    this.detectedText.y = 10;

    this.centsText = new Text({ text: `${t("cents")} --`, style: smallStyle });
    this.centsText.x = 10;
    this.centsText.y = 35;

    this.confidenceText = new Text({ text: `${t("conf")} --`, style: smallStyle });
    this.confidenceText.x = 10;
    this.confidenceText.y = 55;

    this.lockedText = new Text({
      text: "",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 20, fill: 0x00ff88, fontWeight: "bold" }),
    });
    this.lockedText.x = 200;
    this.lockedText.y = 10;

    this.scoreText = new Text({ text: `${t("score")} 0`, style: scoreStyle });
    this.scoreText.anchor.set(1, 0);
    this.scoreText.x = this.app.screen.width - 10;
    this.scoreText.y = 10;

    this.comboText = new Text({
      text: "",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 16, fill: 0xff8855 }),
    });
    this.comboText.anchor.set(1, 0);
    this.comboText.x = this.app.screen.width - 10;
    this.comboText.y = 38;

    this.bpmText = new Text({
      text: "",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 14, fill: 0xaaaaaa }),
    });
    this.bpmText.anchor.set(1, 0);
    this.bpmText.x = this.app.screen.width - 10;
    this.bpmText.y = 60;

    this.app.stage.addChild(this.detectedText);
    this.app.stage.addChild(this.centsText);
    this.app.stage.addChild(this.confidenceText);
    this.app.stage.addChild(this.lockedText);
    this.app.stage.addChild(this.scoreText);
    this.app.stage.addChild(this.comboText);
    this.app.stage.addChild(this.bpmText);

    this.livesText = new Text({
      text: "",
      style: new TextStyle({ fontFamily: "sans-serif", fontSize: 28, fill: 0xff3355 }),
    });
    this.livesText.x = 10;
    this.livesText.y = this.app.screen.height - 130;
    this.livesText.visible = false;
    this.app.stage.addChild(this.livesText);

    // Game over overlay
    this.gameOverContainer = new Container();
    this.gameOverContainer.visible = false;

    this.gameOverText = new Text({
      text: t("gameOver"),
      style: new TextStyle({ fontFamily: "monospace", fontSize: 48, fill: 0xff3355, fontWeight: "bold" }),
    });
    this.gameOverText.anchor.set(0.5);
    this.gameOverText.x = this.app.screen.width / 2;
    this.gameOverText.y = this.app.screen.height / 2 - 40;

    this.gameOverScoreText = new Text({
      text: "",
      style: new TextStyle({ fontFamily: "monospace", fontSize: 24, fill: 0xffdd57 }),
    });
    this.gameOverScoreText.anchor.set(0.5);
    this.gameOverScoreText.x = this.app.screen.width / 2;
    this.gameOverScoreText.y = this.app.screen.height / 2 + 20;

    this.gameOverContainer.addChild(this.gameOverText);
    this.gameOverContainer.addChild(this.gameOverScoreText);
    this.app.stage.addChild(this.gameOverContainer);
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  private _showLabels = true;
  private _showFingering = true;
  private _lastHintMidi: number | null = null;

  set showLabels(v: boolean) {
    this._showLabels = v;
  }

  set showFingering(v: boolean) {
    this._showFingering = v;
  }

  private staffY(staffPosition: number): number {
    const bottomLineY = STAFF_TOP + STAFF_HEIGHT;
    return bottomLineY - staffPosition * (STAFF_LINE_GAP / 2);
  }

  render(
    game: RhythmEngine,
    metronome: Metronome,
    pitchResult: PitchResult | null,
    lockedNote: LockedNote | null,
    solfegeLookup?: (midi: number) => string | undefined,
  ): void {
    this.drawStaff();
    this.drawNotes(game);
    this.drawBeatIndicator(metronome);
    this.drawHoldProgress(game);
    this.updateHud(game, pitchResult, lockedNote, solfegeLookup);
  }

  private drawStaff(): void {
    const g = this.staffGraphics;
    g.clear();
    for (let i = 0; i < STAFF_LINES; i++) {
      const y = STAFF_TOP + i * STAFF_LINE_GAP;
      g.moveTo(STAFF_LEFT, y);
      g.lineTo(this.app.screen.width - 20, y);
      g.stroke({ color: 0x444466, width: 1 });
    }
  }

  private getLabel(index: number): Text {
    while (this.labelPool.length <= index) {
      const t = new Text({ text: "", style: noteLabelStyle });
      t.anchor.set(0.5, 0);
      t.visible = false;
      this.labelsContainer.addChild(t);
      this.labelPool.push(t);
    }
    return this.labelPool[index];
  }

  private getAccidental(index: number): Text {
    while (this.accidentalPool.length <= index) {
      const t = new Text({ text: "", style: accidentalStyle });
      t.anchor.set(1, 0.5);
      t.visible = false;
      this.labelsContainer.addChild(t);
      this.accidentalPool.push(t);
    }
    return this.accidentalPool[index];
  }

  private drawNotes(game: RhythmEngine): void {
    const g = this.notesGraphics;
    g.clear();
    const fg = this.fingeringGraphics;
    fg.clear();

    const notes = game.rhythmNotes;
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const y = this.staffY(note.scaleNote.staffPosition);
      this.drawSingleNote(g, note, y);

      const label = this.getLabel(i);
      label.text = note.scaleNote.solfege;
      label.x = note.x;
      label.y = y + NOTE_RADIUS + 4;
      label.alpha = 1;
      label.visible = this._showLabels;

      const acc = this.getAccidental(i);
      if (note.scaleNote.accidental) {
        acc.text = note.scaleNote.accidental;
        acc.x = note.x - NOTE_RADIUS - 3;
        acc.y = y;
        acc.alpha = note.hit ? 0.5 : 1;
        acc.visible = true;
      } else {
        acc.visible = false;
      }
    }

    for (let i = notes.length; i < this.labelPool.length; i++) {
      this.labelPool[i].visible = false;
    }
    for (let i = notes.length; i < this.accidentalPool.length; i++) {
      this.accidentalPool[i].visible = false;
    }

    // Fingering diagram for next note
    if (this._showFingering) {
      const next = notes.find((n) => !n.hit && !n.missed);
      const hintMidi = next ? next.scaleNote.midi : this._lastHintMidi;
      if (hintMidi != null) {
        this._lastHintMidi = hintMidi;
        const holes = getFingering(hintMidi);
        if (holes) {
          const fx = this.app.screen.width - 60;
          const fy = this.app.screen.height / 2 - 40;
          drawFingering(fg, fx, fy, holes, 1.5);
          const octave = hintMidi >= 84 ? 2 : 1;
          this.octaveLabel.text = `oct ${octave}`;
          this.octaveLabel.x = fx;
          this.octaveLabel.y = fy + 80 * 1.5 + 10;
          this.octaveLabel.visible = true;
        }
      }
    } else {
      this.octaveLabel.visible = false;
    }
  }

  private drawSingleNote(g: Graphics, note: RhythmNote, y: number): void {
    let color = 0xffffff;
    let alpha = 1;
    let xOffset = 0;

    if (note.hit) {
      color = 0x00ff88;
      alpha = 0.5;
    } else if (note.missed) {
      color = 0xff3355;
      const elapsed = performance.now() - note.missedTime;
      alpha = Math.max(0.15, 1 - elapsed / 600);
    } else if (note.wrongFlashTime > 0) {
      const elapsed = performance.now() - note.wrongFlashTime;
      if (elapsed < 300) {
        color = 0xff5555;
        xOffset = Math.sin(elapsed * 0.05) * 3 * (1 - elapsed / 300);
      }
    } else if (note.holding) {
      color = 0x00ff88;
      alpha = 0.8;
    }

    const nx = note.x + xOffset;

    // Wrong flash glow
    if (note.wrongFlashTime > 0) {
      const elapsed = performance.now() - note.wrongFlashTime;
      if (elapsed < 300) {
        const glowAlpha = 0.6 * (1 - elapsed / 300);
        g.ellipse(nx, y, NOTE_RADIUS + 5, NOTE_RADIUS * 0.75 + 5);
        g.fill({ color: 0xff2222, alpha: glowAlpha * 0.3 });
        g.ellipse(nx, y, NOTE_RADIUS + 2, NOTE_RADIUS * 0.75 + 2);
        g.stroke({ color: 0xff2222, alpha: glowAlpha, width: 2 });
      }
    }

    // Draw note head based on duration
    this.drawNoteHead(g, nx, y, note.duration, color, alpha);

    // Ledger lines
    const bottomLinePos = 0;
    const topLinePos = (STAFF_LINES - 1) * 2;

    if (note.scaleNote.staffPosition < bottomLinePos) {
      for (let p = bottomLinePos - 2; p >= note.scaleNote.staffPosition; p -= 2) {
        const ly = this.staffY(p);
        g.moveTo(note.x - NOTE_RADIUS - 4, ly);
        g.lineTo(note.x + NOTE_RADIUS + 4, ly);
        g.stroke({ color: 0x444466, width: 1 });
      }
    } else if (note.scaleNote.staffPosition > topLinePos) {
      for (let p = topLinePos + 2; p <= note.scaleNote.staffPosition; p += 2) {
        const ly = this.staffY(p);
        g.moveTo(note.x - NOTE_RADIUS - 4, ly);
        g.lineTo(note.x + NOTE_RADIUS + 4, ly);
        g.stroke({ color: 0x444466, width: 1 });
      }
    }
  }

  private drawNoteHead(g: Graphics, x: number, y: number, duration: NoteDuration, color: number, alpha: number): void {
    switch (duration) {
      case "whole":
        // Hollow oval, no stem
        g.ellipse(x, y, NOTE_RADIUS + 2, NOTE_RADIUS * 0.75);
        g.stroke({ color, alpha, width: 2 });
        break;
      case "half":
        // Hollow oval + stem
        g.ellipse(x, y, NOTE_RADIUS, NOTE_RADIUS * 0.75);
        g.stroke({ color, alpha, width: 2 });
        g.moveTo(x + NOTE_RADIUS - 1, y);
        g.lineTo(x + NOTE_RADIUS - 1, y - 30);
        g.stroke({ color, alpha, width: 2 });
        break;
      case "quarter":
        // Filled oval + stem
        g.ellipse(x, y, NOTE_RADIUS, NOTE_RADIUS * 0.75);
        g.fill({ color, alpha });
        g.moveTo(x + NOTE_RADIUS - 1, y);
        g.lineTo(x + NOTE_RADIUS - 1, y - 30);
        g.stroke({ color, alpha, width: 2 });
        break;
      case "eighth":
        // Filled oval + stem + 1 flag
        g.ellipse(x, y, NOTE_RADIUS, NOTE_RADIUS * 0.75);
        g.fill({ color, alpha });
        g.moveTo(x + NOTE_RADIUS - 1, y);
        g.lineTo(x + NOTE_RADIUS - 1, y - 30);
        g.stroke({ color, alpha, width: 2 });
        // Flag
        g.moveTo(x + NOTE_RADIUS - 1, y - 30);
        g.quadraticCurveTo(x + NOTE_RADIUS + 10, y - 22, x + NOTE_RADIUS + 2, y - 14);
        g.stroke({ color, alpha, width: 2 });
        break;
      case "sixteenth":
        // Filled oval + stem + 2 flags
        g.ellipse(x, y, NOTE_RADIUS, NOTE_RADIUS * 0.75);
        g.fill({ color, alpha });
        g.moveTo(x + NOTE_RADIUS - 1, y);
        g.lineTo(x + NOTE_RADIUS - 1, y - 30);
        g.stroke({ color, alpha, width: 2 });
        // Flag 1
        g.moveTo(x + NOTE_RADIUS - 1, y - 30);
        g.quadraticCurveTo(x + NOTE_RADIUS + 10, y - 22, x + NOTE_RADIUS + 2, y - 14);
        g.stroke({ color, alpha, width: 2 });
        // Flag 2
        g.moveTo(x + NOTE_RADIUS - 1, y - 24);
        g.quadraticCurveTo(x + NOTE_RADIUS + 10, y - 16, x + NOTE_RADIUS + 2, y - 8);
        g.stroke({ color, alpha, width: 2 });
        break;
    }
  }

  private drawBeatIndicator(metronome: Metronome): void {
    const g = this.beatGraphics;
    g.clear();

    if (!metronome.playing) return;

    const centerX = this.app.screen.width / 2;
    const y = STAFF_TOP - 30;
    const dotRadius = 8;
    const spacing = 30;
    const startX = centerX - (3 * spacing) / 2;

    for (let i = 0; i < 4; i++) {
      const x = startX + i * spacing;
      const isActive = i === metronome.currentBeat;
      if (isActive) {
        // Pulse effect based on beat phase
        const pulse = 1 - metronome.beatPhase;
        const r = dotRadius + pulse * 4;
        g.circle(x, y, r);
        g.fill({ color: i === 0 ? 0xffdd57 : 0x00ff88, alpha: 0.5 + pulse * 0.5 });
      } else {
        g.circle(x, y, dotRadius);
        g.fill({ color: 0x444466, alpha: 0.5 });
      }
    }
  }

  private drawHoldProgress(game: RhythmEngine): void {
    const g = this.progressGraphics;
    g.clear();

    // Find front note
    const front = game.rhythmNotes.find((n) => !n.hit && !n.missed);
    if (!front || front.holdProgress <= 0) return;

    const y = this.staffY(front.scaleNote.staffPosition);
    const barWidth = 60;
    const barHeight = 5;
    const barX = front.x - barWidth / 2;
    const barY = y + NOTE_RADIUS + 20;

    // Background
    g.roundRect(barX, barY, barWidth, barHeight, 2);
    g.fill({ color: 0x222244 });

    // Progress fill
    const fillWidth = barWidth * front.holdProgress;
    const fillColor = front.holdProgress >= 0.9 ? 0x00ff88 : 0xffdd57;
    g.roundRect(barX, barY, fillWidth, barHeight, 2);
    g.fill({ color: fillColor, alpha: 0.8 });

    // Border
    g.roundRect(barX, barY, barWidth, barHeight, 2);
    g.stroke({ color: 0x666688, width: 1 });
  }

  private drawTunerGauge(x: number, y: number, cents: number): void {
    const g = this.gaugeGraphics;
    const w = 120;
    const h = 6;
    const clamped = Math.max(-50, Math.min(50, cents));

    g.roundRect(x, y, w, h, 3);
    g.fill({ color: 0x222244 });

    g.roundRect(x + w * 0.35, y, w * 0.3, h, 2);
    g.fill({ color: 0x00ff88, alpha: 0.25 });

    g.rect(x + w * 0.2, y, w * 0.15, h);
    g.fill({ color: 0xffaa33, alpha: 0.2 });
    g.rect(x + w * 0.65, y, w * 0.15, h);
    g.fill({ color: 0xffaa33, alpha: 0.2 });

    const centerX = x + w / 2;
    const indicatorX = centerX + (clamped / 50) * (w / 2);
    const indicatorColor = Math.abs(clamped) < 10 ? 0x00ff88 : Math.abs(clamped) < 25 ? 0xffaa33 : 0xff3355;
    g.circle(indicatorX, y + h / 2, 5);
    g.fill({ color: indicatorColor });

    g.moveTo(centerX, y - 1);
    g.lineTo(centerX, y + h + 1);
    g.stroke({ color: 0x666688, width: 1 });
  }

  private updateHud(
    game: RhythmEngine,
    pitchResult: PitchResult | null,
    lockedNote: LockedNote | null,
    solfegeLookup?: (midi: number) => string | undefined,
  ): void {
    this.gaugeGraphics.clear();
    if (pitchResult) {
      const displayName = solfegeLookup?.(pitchResult.midiNearest) ?? pitchResult.noteName;
      this.detectedText.text = `${t("note")} ${displayName}`;
      this.centsText.text = `${t("cents")} ${pitchResult.cents > 0 ? "+" : ""}${pitchResult.cents.toFixed(0)}`;
      this.confidenceText.text = `${t("conf")} ${(pitchResult.confidence * 100).toFixed(0)}%`;
      this.drawTunerGauge(10, 78, pitchResult.cents);
    } else {
      this.detectedText.text = `${t("note")} --`;
      this.centsText.text = `${t("cents")} --`;
      this.confidenceText.text = `${t("conf")} --`;
    }

    const lockedDisplay = lockedNote ? (solfegeLookup?.(lockedNote.midi) ?? lockedNote.noteName) : "";
    this.lockedText.text = lockedDisplay ? `>> ${lockedDisplay}` : "";
    this.scoreText.text = `${t("score")} ${game.currentScore}`;
    this.scoreText.x = this.app.screen.width - 10;
    this.comboText.x = this.app.screen.width - 10;
    this.bpmText.x = this.app.screen.width - 10;
    this.bpmText.text = `${game.bpm} BPM`;

    if (game.currentCombo > 1) {
      this.comboText.text = `x${game.currentCombo} ${t("combo")}`;
    } else {
      this.comboText.text = "";
    }

    // Celebration
    this.celebrationGraphics.clear();
    const milestoneElapsed = performance.now() - game.lastMilestoneTime;
    if (milestoneElapsed < 1200 && game.lastMilestone > 0) {
      const progress = milestoneElapsed / 1200;
      this.comboText.scale.set(1 + (1 - progress) * 1.5);
      const cx = this.app.screen.width / 2;
      const cy = this.app.screen.height / 2;
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        const dist = progress * 80;
        const px = cx + Math.cos(angle) * dist;
        const py = cy + Math.sin(angle) * dist;
        this.celebrationGraphics.circle(px, py, 3);
        this.celebrationGraphics.fill({ color: 0xffdd57, alpha: 1 - progress });
      }
    } else {
      this.comboText.scale.set(1);
    }

    // Lives
    if (game.strict) {
      this.livesText.visible = true;
      this.livesText.text = "\u2665".repeat(game.lives) + "\u2661".repeat(Math.max(0, 3 - game.lives));
      this.livesText.y = this.app.screen.height - 130;
    } else {
      this.livesText.visible = false;
    }

    // Game over
    this.gameOverContainer.visible = game.gameOver;
    if (game.gameOver) {
      this.gameOverText.x = this.app.screen.width / 2;
      this.gameOverText.y = this.app.screen.height / 2 - 40;
      this.gameOverScoreText.text = `${t("finalScore")} ${game.currentScore}`;
      this.gameOverScoreText.x = this.app.screen.width / 2;
      this.gameOverScoreText.y = this.app.screen.height / 2 + 20;
    }
  }

  getTicker() {
    return this.app.ticker;
  }
}
