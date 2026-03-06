import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { t } from "../i18n.ts";

/** Minimal interface for the game-state fields that every HUD needs. */
export interface HudGameState {
  currentScore: number;
  currentCombo: number;
  lastMilestoneTime: number;
  lastMilestone: number;
  gameOver: boolean;
}

/** Fields produced by createHudTexts(). Each renderer stores a HudElements. */
export interface HudElements {
  scoreText: Text;
  comboText: Text;
  detectedText: Text;
  centsText: Text;
  confidenceText: Text;
  lockedText: Text;
  gameOverContainer: Container;
  gameOverText: Text;
  gameOverScoreText: Text;
}

/**
 * Create the common HUD text objects shared by Renderer and RhythmRenderer.
 * BattleRenderer uses a subset (no confidence/locked) and creates its own,
 * but still shares drawTunerGauge and drawCelebration.
 */
export function createHudTexts(app: Application): HudElements {
  const style = new TextStyle({ fontFamily: "monospace", fontSize: 18, fill: 0xffffff });
  const smallStyle = new TextStyle({ fontFamily: "monospace", fontSize: 14, fill: 0xaaaaaa });
  const scoreStyle = new TextStyle({ fontFamily: "monospace", fontSize: 22, fill: 0xffdd57, fontWeight: "bold" });

  const detectedText = new Text({ text: `${t("note")} --`, style });
  detectedText.x = 10;
  detectedText.y = 10;

  const centsText = new Text({ text: `${t("cents")} --`, style: smallStyle });
  centsText.x = 10;
  centsText.y = 35;

  const confidenceText = new Text({ text: `${t("conf")} --`, style: smallStyle });
  confidenceText.x = 10;
  confidenceText.y = 55;

  const lockedText = new Text({
    text: "",
    style: new TextStyle({ fontFamily: "monospace", fontSize: 20, fill: 0x00ff88, fontWeight: "bold" }),
  });
  lockedText.x = 200;
  lockedText.y = 10;

  const scoreText = new Text({ text: `${t("score")} 0`, style: scoreStyle });
  scoreText.anchor.set(1, 0);
  scoreText.x = app.screen.width - 10;
  scoreText.y = 10;

  const comboText = new Text({
    text: "",
    style: new TextStyle({ fontFamily: "monospace", fontSize: 16, fill: 0xff8855 }),
  });
  comboText.anchor.set(1, 0);
  comboText.x = app.screen.width - 10;
  comboText.y = 38;

  // Game over overlay
  const gameOverContainer = new Container();
  gameOverContainer.visible = false;

  const gameOverText = new Text({
    text: t("gameOver"),
    style: new TextStyle({ fontFamily: "monospace", fontSize: 48, fill: 0xff3355, fontWeight: "bold" }),
  });
  gameOverText.anchor.set(0.5);
  gameOverText.x = app.screen.width / 2;
  gameOverText.y = app.screen.height / 2 - 40;

  const gameOverScoreText = new Text({
    text: "",
    style: new TextStyle({ fontFamily: "monospace", fontSize: 24, fill: 0xffdd57 }),
  });
  gameOverScoreText.anchor.set(0.5);
  gameOverScoreText.x = app.screen.width / 2;
  gameOverScoreText.y = app.screen.height / 2 + 20;

  gameOverContainer.addChild(gameOverText);
  gameOverContainer.addChild(gameOverScoreText);

  return {
    scoreText,
    comboText,
    detectedText,
    centsText,
    confidenceText,
    lockedText,
    gameOverContainer,
    gameOverText,
    gameOverScoreText,
  };
}

/** Draw the tuner gauge. Identical across all 3 renderers. */
export function drawTunerGauge(g: Graphics, x: number, y: number, cents: number): void {
  const w = 120;
  const h = 6;
  const clamped = Math.max(-50, Math.min(50, cents));

  // Background
  g.roundRect(x, y, w, h, 3);
  g.fill({ color: 0x222244 });

  // Green center zone
  g.roundRect(x + w * 0.35, y, w * 0.3, h, 2);
  g.fill({ color: 0x00ff88, alpha: 0.25 });

  // Yellow zones
  g.rect(x + w * 0.2, y, w * 0.15, h);
  g.fill({ color: 0xffaa33, alpha: 0.2 });
  g.rect(x + w * 0.65, y, w * 0.15, h);
  g.fill({ color: 0xffaa33, alpha: 0.2 });

  // Indicator position
  const centerX = x + w / 2;
  const indicatorX = centerX + (clamped / 50) * (w / 2);
  const indicatorColor = Math.abs(clamped) < 10 ? 0x00ff88 : Math.abs(clamped) < 25 ? 0xffaa33 : 0xff3355;
  g.circle(indicatorX, y + h / 2, 5);
  g.fill({ color: indicatorColor });

  // Center tick
  g.moveTo(centerX, y - 1);
  g.lineTo(centerX, y + h + 1);
  g.stroke({ color: 0x666688, width: 1 });
}

/** Draw the combo milestone celebration particle ring. */
export function drawCelebration(
  celebrationGraphics: Graphics,
  comboText: Text,
  game: HudGameState,
  screenWidth: number,
  screenHeight: number,
): void {
  celebrationGraphics.clear();
  const milestoneElapsed = performance.now() - game.lastMilestoneTime;
  if (milestoneElapsed < 1200 && game.lastMilestone > 0) {
    const progress = milestoneElapsed / 1200;
    comboText.scale.set(1 + (1 - progress) * 1.5);
    const cx = screenWidth / 2;
    const cy = screenHeight / 2;
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const dist = progress * 80;
      const px = cx + Math.cos(angle) * dist;
      const py = cy + Math.sin(angle) * dist;
      celebrationGraphics.circle(px, py, 3);
      celebrationGraphics.fill({ color: 0xffdd57, alpha: 1 - progress });
    }
  } else {
    comboText.scale.set(1);
  }
}

/** Update the game over overlay position and text. */
export function updateGameOver(
  hud: HudElements,
  game: HudGameState,
  screenWidth: number,
  screenHeight: number,
): void {
  hud.gameOverContainer.visible = game.gameOver;
  if (game.gameOver) {
    hud.gameOverText.x = screenWidth / 2;
    hud.gameOverText.y = screenHeight / 2 - 40;
    hud.gameOverScoreText.text = `${t("finalScore")} ${game.currentScore}`;
    hud.gameOverScoreText.x = screenWidth / 2;
    hud.gameOverScoreText.y = screenHeight / 2 + 20;
  }
}
