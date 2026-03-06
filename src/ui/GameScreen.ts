import type { GameEngine } from "../game/GameEngine.ts";
import type { RhythmEngine } from "../game/RhythmEngine.ts";
import type { PitchEngine } from "../audio/PitchEngine.ts";
import type { Metronome } from "../audio/Metronome.ts";
import { t } from "../i18n.ts";
import { buildUI, attachListeners } from "./StartScreen.ts";

export interface GameState {
  started: boolean;
  paused: boolean;
  activeTickerCb: (() => void) | null;
  activeTicker: { remove(fn: () => void): void } | null;
  gameAbortController: AbortController | null;
  activeMetronome: Metronome | null;
  onStartGame: () => void;
}

export function togglePause(state: GameState): void {
  state.paused = !state.paused;
  document.getElementById("pause-overlay")!.style.display = state.paused ? "flex" : "none";
}

export function goBack(state: GameState, pitch: PitchEngine): void {
  state.paused = false;
  document.getElementById("pause-overlay")!.style.display = "none";

  state.gameAbortController?.abort();
  state.gameAbortController = null;

  // Stop the active game loop
  if (state.activeTickerCb && state.activeTicker) {
    state.activeTicker.remove(state.activeTickerCb);
    state.activeTickerCb = null;
    state.activeTicker = null;
  }

  // Clear the game container canvas
  const container = document.getElementById("game-container")!;
  container.style.display = "none";
  // Remove the PixiJS canvas
  const canvas = container.querySelector("canvas");
  if (canvas) canvas.remove();

  pitch.setOnLock(null);
  if (state.activeMetronome) {
    state.activeMetronome.stop();
    state.activeMetronome = null;
  }
  state.started = false;

  // Rebuild UI and re-attach listeners
  buildUI();
  attachListeners(state.onStartGame);
}

export function showResults(game: GameEngine | RhythmEngine, signal: AbortSignal, onGoBack: () => void): void {
  const overlay = document.getElementById("results-overlay")!;
  const total = game.totalHit + game.totalMissed;
  const accuracy = total > 0 ? ((game.totalHit / total) * 100).toFixed(1) : "0";
  document.getElementById("results-hit")!.textContent = `${t("notesHit")}: ${game.totalHit}`;
  document.getElementById("results-missed")!.textContent = `${t("notesMissed")}: ${game.totalMissed}`;
  document.getElementById("results-accuracy")!.textContent = `${t("accuracy")}: ${accuracy}%`;
  document.getElementById("results-combo")!.textContent = `${t("longestCombo")}: ${game.maxCombo}`;
  document.getElementById("results-score")!.textContent = `${t("score")} ${game.currentScore}`;
  overlay.style.display = "flex";
  document.getElementById("results-exit-btn")!.addEventListener("click", onGoBack, { signal });
}

export function setupGameControls(state: GameState, pitch: PitchEngine): AbortSignal {
  state.gameAbortController?.abort();
  state.gameAbortController = new AbortController();
  const signal = state.gameAbortController.signal;

  const onGoBack = () => goBack(state, pitch);

  document.getElementById("pause-btn")!.addEventListener("click", () => togglePause(state), { signal });
  document.getElementById("resume-btn")!.addEventListener("click", () => togglePause(state), { signal });
  document.getElementById("exit-btn")!.addEventListener("click", onGoBack, { signal });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && state.started) {
      e.preventDefault();
      togglePause(state);
    }
  }, { signal });

  return signal;
}

export function showEscHint(): void {
  const escHint = document.getElementById("esc-hint")!;
  escHint.style.display = "block";
  escHint.style.opacity = "1";
  setTimeout(() => {
    escHint.style.opacity = "0";
    setTimeout(() => { escHint.style.display = "none"; }, 1000);
  }, 3000);
}

export function prepareGameContainer(): void {
  document.getElementById("start-screen")!.style.display = "none";
  document.getElementById("loading-screen")!.style.display = "flex";
}

export function showGameContainer(): void {
  document.getElementById("loading-screen")!.style.display = "none";
  const container = document.getElementById("game-container")!;
  container.style.display = "block";
  document.getElementById("pause-overlay")!.style.display = "none";
  document.getElementById("results-overlay")!.style.display = "none";
}
