import "./style.css";
import { AudioEngine } from "./audio/AudioEngine.ts";
import { PitchEngine } from "./audio/PitchEngine.ts";
import { MusicEngine } from "./music/MusicEngine.ts";
import { GameEngine } from "./game/GameEngine.ts";
import { BattleEngine } from "./game/BattleEngine.ts";
import { Renderer } from "./render/Renderer.ts";
import { BattleRenderer } from "./render/BattleRenderer.ts";
import { RhythmEngine } from "./game/RhythmEngine.ts";
import { RhythmRenderer } from "./render/RhythmRenderer.ts";
import { Metronome } from "./audio/Metronome.ts";
import { logInit, log } from "./debug/logger.ts";
import { getPlayerName, setPlayerName, addScore } from "./leaderboard.ts";
import { t } from "./i18n.ts";

import { SOPILKA_LOW, getSavedSessionLength, getSavedRhythmBpm, getSavedRhythmComplexity, getSavedRhythmTolerance, isCompeteMode } from "./settings.ts";
import { buildUI, attachListeners, getSelectedKey } from "./ui/StartScreen.ts";
import { type GameState, goBack, showResults, setupGameControls, showEscHint, prepareGameContainer, showGameContainer } from "./ui/GameScreen.ts";
import { runCalibration } from "./ui/Calibration.ts";

const audio = new AudioEngine();
const pitch = new PitchEngine();
const music = new MusicEngine();

const state: GameState = {
  started: false,
  paused: false,
  activeTickerCb: null,
  activeTicker: null,
  gameAbortController: null,
  activeMetronome: null,
  onStartGame: startGame,
};

function startSheetMode(signal: AbortSignal): void {
  const container = document.getElementById("game-container")!;
  const renderer = new Renderer();

  // Show sheet-specific buttons
  document.getElementById("wait-toggle")!.style.display = "";
  document.getElementById("clean-toggle")!.style.display = "";

  renderer.init(container).then(() => {
    const game = new GameEngine(music);
    game.setGameWidth(renderer.width);
    const sessionLen = getSavedSessionLength();
    if (sessionLen > 0) game.setSessionLength(sessionLen);

    pitch.setOnLock((note) => {
      const hit = game.tryHit(note.midi);
      if (!hit) game.triggerWrongFlash();
      log("LOCK", { midi: note.midi, noteName: note.noteName, hit: hit !== null });
    });

    const waitToggle = document.getElementById("wait-toggle")!;
    waitToggle.addEventListener("click", () => {
      const newMode = !game.waitMode;
      game.setWaitMode(newMode);
      waitToggle.textContent = newMode ? t("modeWait") : t("modeScroll");
    }, { signal });

    let labelsOn = true;
    const labelsToggle = document.getElementById("labels-toggle")!;
    labelsToggle.addEventListener("click", () => {
      labelsOn = !labelsOn;
      renderer.showLabels = labelsOn;
      labelsToggle.textContent = labelsOn ? t("labelsOn") : t("labelsOff");
    }, { signal });

    let hintsOn = true;
    const hintsToggle = document.getElementById("hints-toggle")!;
    hintsToggle.addEventListener("click", () => {
      hintsOn = !hintsOn;
      renderer.showFingering = hintsOn;
      hintsToggle.textContent = hintsOn ? t("hintsOn") : t("hintsOff");
    }, { signal });

    let cleanOn = false;
    const cleanToggle = document.getElementById("clean-toggle")!;
    cleanToggle.addEventListener("click", () => {
      cleanOn = !cleanOn;
      game.setCleanMode(cleanOn);
      cleanToggle.textContent = cleanOn ? t("cleanOn") : t("cleanOff");
    }, { signal });

    const onGoBack = () => goBack(state, pitch);
    let lastPitchLog = 0;
    let sessionShown = false;
    const tickerCb = () => {
      if (state.paused) return;
      const dt = renderer.getTicker().deltaMS / 1000;
      const now = performance.now();

      pitch.update(audio);
      game.setGameWidth(renderer.width);
      game.update(dt, now);
      renderer.render(game, pitch.lastResult, pitch.lockedNote, (midi) => music.noteForMidi(midi)?.solfege);

      if ((game.sessionDone || game.gameOver) && !sessionShown) {
        sessionShown = true;
        showResults(game, signal, onGoBack);
      }

      const r = pitch.lastResult;
      if (r && now - lastPitchLog > 200) {
        lastPitchLog = now;
        log("PITCH", { freq: +r.freq.toFixed(1), midi: +r.midiFloat.toFixed(2), nearest: r.midiNearest, cents: +r.cents.toFixed(1), conf: +r.confidence.toFixed(2), note: r.noteName });
      }
    };

    renderer.getTicker().add(tickerCb);
    state.activeTicker = renderer.getTicker();
    state.activeTickerCb = tickerCb;
  });
}

function startBattleMode(signal: AbortSignal): void {
  const currentKey = getSelectedKey();
  const container = document.getElementById("game-container")!;
  const battleRenderer = new BattleRenderer();

  // Hide sheet-specific buttons
  document.getElementById("wait-toggle")!.style.display = "none";
  document.getElementById("clean-toggle")!.style.display = "none";

  battleRenderer.init(container).then(() => {
    const battle = new BattleEngine(music);
    battle.setDimensions(battleRenderer.width, battleRenderer.height);

    pitch.setOnLock((note) => {
      const now = performance.now();
      const hit = battle.tryHit(note.midi, now);
      log("LOCK", { midi: note.midi, noteName: note.noteName, hit: hit !== null });
    });

    let labelsOn = true;
    const labelsToggle = document.getElementById("labels-toggle")!;
    labelsToggle.addEventListener("click", () => {
      labelsOn = !labelsOn;
      battleRenderer.showLabels = labelsOn;
      labelsToggle.textContent = labelsOn ? t("labelsOn") : t("labelsOff");
    }, { signal });

    let hintsOn = true;
    const hintsToggle = document.getElementById("hints-toggle")!;
    hintsToggle.addEventListener("click", () => {
      hintsOn = !hintsOn;
      battleRenderer.showFingering = hintsOn;
      hintsToggle.textContent = hintsOn ? t("hintsOn") : t("hintsOff");
    }, { signal });

    const onGoBack = () => goBack(state, pitch);
    let lastPitchLog = 0;
    let scoreSaved = false;
    const tickerCb = () => {
      if (state.paused) return;
      const dt = battleRenderer.getTicker().deltaMS / 1000;
      const now = performance.now();

      pitch.update(audio);
      battle.updateDimensions(battleRenderer.width, battleRenderer.height);
      battle.update(dt, now);
      battleRenderer.render(battle, pitch.lastResult, pitch.lockedNote, (midi) => music.noteForMidi(midi)?.solfege);

      if (battle.gameOver && !scoreSaved) {
        scoreSaved = true;
        if (isCompeteMode() && getPlayerName()) {
          addScore(getPlayerName(), battle.currentScore, "battle", currentKey);
        }
      }

      const r = pitch.lastResult;
      if (r && now - lastPitchLog > 200) {
        lastPitchLog = now;
        log("PITCH", { freq: +r.freq.toFixed(1), midi: +r.midiFloat.toFixed(2), nearest: r.midiNearest, cents: +r.cents.toFixed(1), conf: +r.confidence.toFixed(2), note: r.noteName });
      }
    };

    battleRenderer.getTicker().add(tickerCb);
    state.activeTicker = battleRenderer.getTicker();
    state.activeTickerCb = tickerCb;

    battleRenderer.onGoBack = onGoBack;
  });
}

function startRhythmMode(signal: AbortSignal): void {
  const container = document.getElementById("game-container")!;
  const renderer = new RhythmRenderer();

  // Hide sheet-specific buttons, show rhythm-specific
  document.getElementById("wait-toggle")!.style.display = "none";
  document.getElementById("clean-toggle")!.style.display = "none";
  document.getElementById("strict-toggle")!.style.display = "";

  renderer.init(container).then(() => {
    const game = new RhythmEngine(music);
    game.setGameWidth(renderer.width);
    game.setBpm(getSavedRhythmBpm());
    game.setComplexity(getSavedRhythmComplexity());
    game.setTolerance(getSavedRhythmTolerance());

    const sessionLen = getSavedSessionLength();
    if (sessionLen > 0) game.setSessionLength(sessionLen);

    const metronome = new Metronome();
    metronome.setBpm(getSavedRhythmBpm());
    state.activeMetronome = metronome;

    // Start metronome using audio engine's context
    const audioCtx = audio.getContext();
    if (audioCtx) {
      metronome.start(audioCtx);
    }

    // No onLock needed -- rhythm mode polls pitch state each frame

    let labelsOn = true;
    const labelsToggle = document.getElementById("labels-toggle")!;
    labelsToggle.addEventListener("click", () => {
      labelsOn = !labelsOn;
      renderer.showLabels = labelsOn;
      labelsToggle.textContent = labelsOn ? t("labelsOn") : t("labelsOff");
    }, { signal });

    let hintsOn = true;
    const hintsToggle = document.getElementById("hints-toggle")!;
    hintsToggle.addEventListener("click", () => {
      hintsOn = !hintsOn;
      renderer.showFingering = hintsOn;
      hintsToggle.textContent = hintsOn ? t("hintsOn") : t("hintsOff");
    }, { signal });

    let strictOn = false;
    const strictToggle = document.getElementById("strict-toggle")!;
    strictToggle.addEventListener("click", () => {
      strictOn = !strictOn;
      game.setStrict(strictOn);
      strictToggle.textContent = strictOn ? t("strictOn") : t("strictOff");
    }, { signal });

    const onGoBack = () => goBack(state, pitch);
    let lastPitchLog = 0;
    let sessionShown = false;
    const tickerCb = () => {
      if (state.paused) return;
      const dt = renderer.getTicker().deltaMS / 1000;
      const now = performance.now();

      pitch.update(audio);
      metronome.update(now);
      game.setGameWidth(renderer.width);

      // Poll locked note for duration checking
      const lockedMidi = pitch.lockedNote ? pitch.lockedNote.midi : null;
      game.update(dt, now, lockedMidi);

      renderer.render(game, metronome, pitch.lastResult, pitch.lockedNote, (midi) => music.noteForMidi(midi)?.solfege);

      if ((game.sessionDone || game.gameOver) && !sessionShown) {
        sessionShown = true;
        metronome.stop();
        showResults(game, signal, onGoBack);
      }

      const r = pitch.lastResult;
      if (r && now - lastPitchLog > 200) {
        lastPitchLog = now;
        log("PITCH", { freq: +r.freq.toFixed(1), midi: +r.midiFloat.toFixed(2), nearest: r.midiNearest, cents: +r.cents.toFixed(1), conf: +r.confidence.toFixed(2), note: r.noteName });
      }
    };

    renderer.getTicker().add(tickerCb);
    state.activeTicker = renderer.getTicker();
    state.activeTickerCb = tickerCb;
  });
}

async function startGame(): Promise<void> {
  if (state.started) return;

  if (isCompeteMode()) {
    const playerName = (document.getElementById("player-name") as HTMLInputElement).value.trim();
    if (!playerName) {
      (document.getElementById("player-name") as HTMLInputElement).focus();
      return;
    }
    setPlayerName(playerName);
  }

  const tonic = (document.getElementById("tonic") as HTMLSelectElement).value;
  const mode = (document.getElementById("mode") as HTMLSelectElement).value as "major" | "minor";
  const gameMode = (document.getElementById("game-mode") as HTMLSelectElement).value;
  const fullRange = (document.getElementById("all-notes-check") as HTMLInputElement).checked;

  // Compute tonic MIDI at or above sopilka low
  const TONIC_SEMITONES: Record<string, number> = {
    "C": 0, "Db": 1, "D": 2, "Eb": 3, "E": 4, "F": 5,
    "Gb": 6, "G": 7, "Ab": 8, "A": 9, "Bb": 10, "B": 11,
  };
  let lowMidi: number, highMidi: number;
  if (fullRange) {
    // Full sopilka range: C-C-C (2 octaves)
    lowMidi = SOPILKA_LOW;
    highMidi = SOPILKA_LOW + 24;
  } else {
    // 1 octave from the tonic
    lowMidi = SOPILKA_LOW + (TONIC_SEMITONES[tonic] ?? 0);
    if (lowMidi < SOPILKA_LOW) lowMidi += 12;
    highMidi = lowMidi + 12;
  }

  music.setKey(tonic, mode);
  music.setRange(lowMidi, highMidi);

  if (music.notes.length === 0) {
    alert(t("alertNoNotes"));
    return;
  }

  try {
    await audio.start();
  } catch (e) {
    alert(t("alertMic"));
    console.error(e);
    return;
  }

  state.started = true;
  logInit();
  log("CONFIG", { tonic, mode, gameMode, lowMidi: SOPILKA_LOW, highMidi: highMidi, noteCount: music.notes.length });

  prepareGameContainer();

  const shouldCalibrate = (document.getElementById("calibrate-check") as HTMLInputElement).checked;
  if (shouldCalibrate) {
    document.getElementById("loading-screen")!.style.display = "none";
    await runCalibration(audio, pitch, music);
  }

  state.paused = false;
  showGameContainer();
  showEscHint();

  const signal = setupGameControls(state, pitch);

  if (gameMode === "battle") {
    startBattleMode(signal);
  } else if (gameMode === "rhythm") {
    startRhythmMode(signal);
  } else {
    startSheetMode(signal);
  }
}

buildUI();
attachListeners(startGame);
