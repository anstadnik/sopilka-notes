import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import type { GameEngine, GameNote } from "../game/GameEngine.ts";
import type { PitchResult, LockedNote } from "../audio/PitchEngine.ts";
import { getFingering } from "../music/fingerings.ts";
import { drawFingering } from "./fingeringDiagram.ts";

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

export class Renderer {
  private app: Application;
  private staffGraphics!: Graphics;
  private notesGraphics!: Graphics;
  private fingeringGraphics!: Graphics;
  private hudGraphics!: Graphics;
  private labelsContainer!: Container;
  private labelPool: Text[] = [];

  private detectedText!: Text;
  private centsText!: Text;
  private confidenceText!: Text;
  private scoreText!: Text;
  private comboText!: Text;
  private lockedText!: Text;

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
    this.labelsContainer = new Container();

    this.app.stage.addChild(this.staffGraphics);
    this.app.stage.addChild(this.notesGraphics);
    this.app.stage.addChild(this.fingeringGraphics);
    this.app.stage.addChild(this.labelsContainer);
    this.app.stage.addChild(this.hudGraphics);

    const style = new TextStyle({
      fontFamily: "monospace",
      fontSize: 18,
      fill: 0xffffff,
    });
    const smallStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 14,
      fill: 0xaaaaaa,
    });
    const scoreStyle = new TextStyle({
      fontFamily: "monospace",
      fontSize: 22,
      fill: 0xffdd57,
      fontWeight: "bold",
    });

    this.detectedText = new Text({ text: "Note: --", style });
    this.detectedText.x = 10;
    this.detectedText.y = 10;

    this.centsText = new Text({ text: "Cents: --", style: smallStyle });
    this.centsText.x = 10;
    this.centsText.y = 35;

    this.confidenceText = new Text({ text: "Conf: --", style: smallStyle });
    this.confidenceText.x = 10;
    this.confidenceText.y = 55;

    this.lockedText = new Text({ text: "", style: new TextStyle({
      fontFamily: "monospace",
      fontSize: 20,
      fill: 0x00ff88,
      fontWeight: "bold",
    }) });
    this.lockedText.x = 200;
    this.lockedText.y = 10;

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

    this.app.stage.addChild(this.detectedText);
    this.app.stage.addChild(this.centsText);
    this.app.stage.addChild(this.confidenceText);
    this.app.stage.addChild(this.lockedText);
    this.app.stage.addChild(this.scoreText);
    this.app.stage.addChild(this.comboText);
  }

  get width(): number {
    return this.app.screen.width;
  }

  get height(): number {
    return this.app.screen.height;
  }

  private staffY(staffPosition: number): number {
    // staffPosition 0 = bottom line (E4)
    // Each step is half a line gap
    const bottomLineY = STAFF_TOP + STAFF_HEIGHT;
    return bottomLineY - staffPosition * (STAFF_LINE_GAP / 2);
  }

  private _showLabels = true;
  private _showFingering = false;

  set showLabels(v: boolean) {
    this._showLabels = v;
  }

  set showFingering(v: boolean) {
    this._showFingering = v;
  }

  render(game: GameEngine, pitchResult: PitchResult | null, lockedNote: LockedNote | null, solfegeLookup?: (midi: number) => string | undefined): void {
    this.drawStaff();
    this.drawNotes(game);
    this.updateHud(game, pitchResult, lockedNote, solfegeLookup);
  }

  private drawStaff(): void {
    const g = this.staffGraphics;
    g.clear();

    // Draw 5 staff lines
    for (let i = 0; i < STAFF_LINES; i++) {
      const y = STAFF_TOP + i * STAFF_LINE_GAP;
      g.moveTo(STAFF_LEFT, y);
      g.lineTo(this.app.screen.width - 20, y);
      g.stroke({ color: 0x444466, width: 1 });
    }

    // Treble clef area indicator
    const clefStyle = new TextStyle({
      fontFamily: "serif",
      fontSize: 48,
      fill: 0x666688,
    });
    // Simple G clef unicode
    const clef = new Text({ text: "𝄞", style: clefStyle });
    clef.x = STAFF_LEFT - 5;
    clef.y = STAFF_TOP - 10;
    // Add to staffGraphics parent so it redraws
    // We avoid re-adding by checking if already there
    if (this.app.stage.children.indexOf(clef) === -1) {
      // Only add once - use a flag
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

  private drawNotes(game: GameEngine): void {
    const g = this.notesGraphics;
    g.clear();

    const fg = this.fingeringGraphics;
    fg.clear();

    const notes = game.gameNotes;
    for (let i = 0; i < notes.length; i++) {
      const note = notes[i];
      const y = this.staffY(note.scaleNote.staffPosition);
      this.drawSingleNote(g, note, y);

      // Position label
      const label = this.getLabel(i);
      label.text = note.scaleNote.solfege;
      label.x = note.x;
      label.y = y + NOTE_RADIUS + 4;
      label.alpha = 1;
      label.visible = this._showLabels;
    }

    // Hide unused labels
    for (let i = notes.length; i < this.labelPool.length; i++) {
      this.labelPool[i].visible = false;
    }

    // One big fingering diagram for the next note to play
    if (this._showFingering) {
      const next = notes.find((n) => !n.hit);
      if (next) {
        const holes = getFingering(next.scaleNote.midi);
        if (holes) {
          drawFingering(fg, this.app.screen.width - 60, this.app.screen.height / 2 - 40, holes, 1.5);
        }
      }
    }
  }

  private drawSingleNote(g: Graphics, note: GameNote, y: number): void {
    let color = 0xffffff;
    let alpha = 1;

    if (note.hit) {
      color = 0x00ff88;
      alpha = 0.5;
    }

    // Note head (filled ellipse)
    g.ellipse(note.x, y, NOTE_RADIUS, NOTE_RADIUS * 0.75);
    g.fill({ color, alpha });

    // Stem
    g.moveTo(note.x + NOTE_RADIUS - 1, y);
    g.lineTo(note.x + NOTE_RADIUS - 1, y - 30);
    g.stroke({ color, alpha, width: 2 });

    // Ledger lines if needed
    const bottomLinePos = 0;
    const topLinePos = (STAFF_LINES - 1) * 2; // = 8

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

  private updateHud(game: GameEngine, pitchResult: PitchResult | null, lockedNote: LockedNote | null, solfegeLookup?: (midi: number) => string | undefined): void {
    if (pitchResult) {
      const displayName = solfegeLookup?.(pitchResult.midiNearest) ?? pitchResult.noteName;
      this.detectedText.text = `Note: ${displayName}`;
      this.centsText.text = `Cents: ${pitchResult.cents > 0 ? "+" : ""}${pitchResult.cents.toFixed(0)}`;
      this.confidenceText.text = `Conf: ${(pitchResult.confidence * 100).toFixed(0)}%`;
    } else {
      this.detectedText.text = "Note: --";
      this.centsText.text = "Cents: --";
      this.confidenceText.text = "Conf: --";
    }

    const lockedDisplay = lockedNote ? (solfegeLookup?.(lockedNote.midi) ?? lockedNote.noteName) : "";
    this.lockedText.text = lockedDisplay ? `>> ${lockedDisplay}` : "";
    this.scoreText.text = `Score: ${game.currentScore}`;
    this.scoreText.x = this.app.screen.width - 10;
    this.comboText.x = this.app.screen.width - 10;

    if (game.currentCombo > 1) {
      this.comboText.text = `x${game.currentCombo} combo`;
    } else {
      this.comboText.text = "";
    }
  }

  getTicker() {
    return this.app.ticker;
  }
}
