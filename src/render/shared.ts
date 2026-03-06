import { Container, Text, TextStyle } from "pixi.js";

// ── Staff dimension constants (used by Renderer and RhythmRenderer) ──
export const STAFF_TOP = 80;
export const STAFF_LINE_GAP = 24;
export const STAFF_LINES = 5;
export const STAFF_LEFT = 60;
export const NOTE_RADIUS = 10;
const STAFF_HEIGHT = (STAFF_LINES - 1) * STAFF_LINE_GAP;

// ── Shared text styles (used by pool utilities below) ──
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

// ── Staff position helper ──
export function staffY(staffPosition: number): number {
  const bottomLineY = STAFF_TOP + STAFF_HEIGHT;
  return bottomLineY - staffPosition * (STAFF_LINE_GAP / 2);
}

// ── Text pool utilities ──

export function getPooledLabel(
  pool: Text[],
  container: Container,
  index: number,
): Text {
  while (pool.length <= index) {
    const t = new Text({ text: "", style: noteLabelStyle });
    t.anchor.set(0.5, 0);
    t.visible = false;
    container.addChild(t);
    pool.push(t);
  }
  return pool[index];
}

export function getPooledAccidental(
  pool: Text[],
  container: Container,
  index: number,
): Text {
  while (pool.length <= index) {
    const t = new Text({ text: "", style: accidentalStyle });
    t.anchor.set(1, 0.5);
    t.visible = false;
    container.addChild(t);
    pool.push(t);
  }
  return pool[index];
}

export function hidePoolFrom(pool: Text[], startIndex: number): void {
  for (let i = startIndex; i < pool.length; i++) {
    pool[i].visible = false;
  }
}
