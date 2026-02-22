import type { Graphics } from "pixi.js";

/**
 * Draw a sopilka fingering diagram as two side-by-side views:
 *   Left  = back view (2 thumb holes)
 *   Right = front view (8 finger holes)
 *
 * Like on the standard applicature chart.
 *
 * @param g       Graphics context (not cleared — caller manages that)
 * @param cx      Center-X of the whole diagram
 * @param topY    Top-Y of the diagram
 * @param holes   10-element array: [back1, back2, front1..front8], 1=closed 0=open 0.5=half
 * @param scale   Uniform scale (default 1)
 */
export function drawFingering(
  g: Graphics,
  cx: number,
  topY: number,
  holes: readonly number[],
  scale = 1,
): void {
  const s = scale;

  const bodyW = 16 * s;
  const bodyH = 80 * s;
  const gap = 6 * s;
  const holeR = 3 * s;

  // Two sopilka bodies side by side
  const backX = cx - gap / 2 - bodyW / 2;
  const frontX = cx + gap / 2 + bodyW / 2;

  // Draw back view body
  drawBody(g, backX, topY, bodyW, bodyH, s);
  // Draw front view body
  drawBody(g, frontX, topY, bodyW, bodyH, s);

  // Back holes (2) — evenly spaced in the upper portion
  const backStartY = topY + 12 * s;
  const backGap = 12 * s;
  for (let i = 0; i < 2; i++) {
    drawHole(g, backX, backStartY + i * backGap, holeR, holes[i]);
  }

  // Front holes (8) — evenly spaced along the body
  const frontStartY = topY + 8 * s;
  const frontGap = 8.5 * s;
  for (let i = 0; i < 8; i++) {
    drawHole(g, frontX, frontStartY + i * frontGap, holeR, holes[2 + i]);
  }
}

function drawBody(g: Graphics, cx: number, topY: number, w: number, h: number, s: number): void {
  const x = cx - w / 2;
  // Mouthpiece taper at top
  g.moveTo(cx - w * 0.3, topY);
  g.lineTo(cx - w / 2, topY + 6 * s);
  g.lineTo(cx - w / 2, topY + h);
  g.lineTo(cx + w / 2, topY + h);
  g.lineTo(cx + w / 2, topY + 6 * s);
  g.lineTo(cx + w * 0.3, topY);
  g.closePath();
  g.fill({ color: 0x3a2a1a, alpha: 0.75 });

  // Outline
  g.moveTo(cx - w * 0.3, topY);
  g.lineTo(cx - w / 2, topY + 6 * s);
  g.lineTo(cx - w / 2, topY + h);
  g.lineTo(cx + w / 2, topY + h);
  g.lineTo(cx + w / 2, topY + 6 * s);
  g.lineTo(cx + w * 0.3, topY);
  g.closePath();
  g.stroke({ color: 0x665533, width: 1 * s });

  void x; // cx-based drawing
}

function drawHole(g: Graphics, x: number, y: number, r: number, state: number): void {
  if (state === 1) {
    // Closed — filled dark
    g.circle(x, y, r);
    g.fill({ color: 0x111111 });
    g.circle(x, y, r);
    g.stroke({ color: 0x000000, width: 0.6 });
  } else if (state === 0) {
    // Open — empty with border
    g.circle(x, y, r);
    g.fill({ color: 0xeeeeee, alpha: 0.95 });
    g.circle(x, y, r);
    g.stroke({ color: 0x333333, width: 0.8 });
  } else {
    // Half-hole — half filled
    g.circle(x, y, r);
    g.fill({ color: 0xeeeeee, alpha: 0.95 });
    // Left half filled
    g.moveTo(x, y - r);
    g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, true);
    g.lineTo(x, y - r);
    g.fill({ color: 0x111111 });
    // Border
    g.circle(x, y, r);
    g.stroke({ color: 0x333333, width: 0.8 });
  }
}
