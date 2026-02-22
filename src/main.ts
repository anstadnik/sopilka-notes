import "./style.css";
import { AudioEngine } from "./audio/AudioEngine.ts";
import { PitchEngine } from "./audio/PitchEngine.ts";
import { MusicEngine } from "./music/MusicEngine.ts";
import { GameEngine } from "./game/GameEngine.ts";
import { BattleEngine } from "./game/BattleEngine.ts";
import { Renderer } from "./render/Renderer.ts";
import { BattleRenderer } from "./render/BattleRenderer.ts";
import { logInit, log } from "./debug/logger.ts";
import { getPlayerName, setPlayerName, addScore, getLeaderboard } from "./leaderboard.ts";
import { t, getLang, setLang, type Lang } from "./i18n.ts";

const audio = new AudioEngine();
const pitch = new PitchEngine();
const music = new MusicEngine();

let started = false;
let paused = false;
let activeTickerCb: (() => void) | null = null;
let activeTicker: { remove(fn: () => void): void } | null = null;

// Sopilka physical range starts at C5
const SOPILKA_LOW = 72; // C5

function getSelectedKey(): string {
  const tonic = (document.getElementById("tonic") as HTMLSelectElement)?.value ?? "C";
  const mode = (document.getElementById("mode") as HTMLSelectElement)?.value ?? "major";
  return `${tonic} ${mode}`;
}

function renderLeaderboard(entries: { name: string; score: number; mode: string }[], key: string): string {
  if (entries.length === 0) return `<div id="leaderboard"><p class="hint">${t("noScores")} ${key}</p></div>`;
  const rows = entries
    .slice(0, 10)
    .map((e, i) => `<tr><td>${i + 1}</td><td>${e.name}</td><td>${e.score}</td><td>${e.mode}</td></tr>`)
    .join("");
  return `
    <div id="leaderboard">
      <h3>${t("leaderboard")} — ${key}</h3>
      <table>
        <thead><tr><th>#</th><th>${t("lbName")}</th><th>${t("lbScore")}</th><th>${t("lbMode")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function refreshLeaderboard(): void {
  const key = getSelectedKey();
  getLeaderboard(key).then((entries) => {
    const el = document.getElementById("leaderboard");
    if (el) el.outerHTML = renderLeaderboard(entries, key);
  });
}

function buildUI(): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const savedName = getPlayerName();
  const otherLang: Lang = getLang() === "uk" ? "en" : "uk";
  const langLabel = otherLang === "en" ? "\u{1F1EC}\u{1F1E7}" : "\u{1F1FA}\u{1F1E6}";
  app.innerHTML = `
    <div id="start-screen">
      <div class="title-row">
        <h1>${t("title")}</h1>
        <button id="lang-btn" class="lang-btn">${langLabel}</button>
      </div>
      <div class="settings">
        <label>
          ${t("player")}
          <input id="player-name" type="text" placeholder="${t("playerPlaceholder")}" maxlength="20" value="${savedName}" />
        </label>
      </div>
      <div class="settings">
        <label>
          ${t("key")}
          <select id="tonic">
            <option>C</option><option>Db</option><option>D</option><option>Eb</option>
            <option>E</option><option>F</option><option>Gb</option><option>G</option>
            <option>Ab</option><option>A</option><option>Bb</option><option>B</option>
          </select>
        </label>
        <label>
          ${t("mode")}
          <select id="mode">
            <option value="major">${t("major")}</option>
            <option value="minor">${t("minor")}</option>
          </select>
        </label>
        <label id="all-notes-label">
          <input id="all-notes-check" type="checkbox" checked />
          ${t("fullRange")}
        </label>
      </div>
      <div class="settings">
        <label>
          ${t("game")}
          <select id="game-mode">
            <option value="battle">${t("monsterDefense")}</option>
            <option value="sheet">${t("sheetMusic")}</option>
          </select>
        </label>
      </div>
      <div class="settings">
        <label>
          <input id="calibrate-check" type="checkbox" />
          ${t("enableCalibration")}
        </label>
        <p class="hint" style="margin:4px 0 0">${t("calibrationHint")}</p>
      </div>
      <button id="start-btn">${t("startBtn")}</button>
      <p class="hint">${t("startHint")}</p>
      ${renderLeaderboard([], "C major")}
    </div>
    <div id="calibration-screen">
      <h2>${t("calibration")}</h2>
      <p id="cal-step">${t("calNote")} 1 / 8</p>
      <p id="cal-instruction">${t("calPlayAndHold").replace("{note}", "do")}</p>
      <p id="cal-status" class="hint">${t("calWaiting")}</p>
      <div class="progress-bar"><div id="cal-progress" class="progress-fill"></div></div>
      <p id="cal-detected">${t("calListening")}</p>
    </div>
    <div id="game-container">
      <div class="game-btn-bar">
        <button id="pause-btn" class="game-btn">${t("pause")}</button>
        <div class="game-btn-right">
          <button id="wait-toggle" class="game-btn">${t("modeWait")}</button>
          <button id="labels-toggle" class="game-btn">${t("labelsOn")}</button>
          <button id="hints-toggle" class="game-btn">${t("hintsOn")}</button>
        </div>
      </div>
      <div id="pause-overlay">
        <h2>${t("paused")}</h2>
        <button id="resume-btn" class="pause-menu-btn">${t("resume")}</button>
        <button id="exit-btn" class="pause-menu-btn exit">${t("exitToMenu")}</button>
      </div>
    </div>
  `;

  // Load leaderboard asynchronously
  refreshLeaderboard();
}

async function runCalibration(): Promise<void> {
  const calScreen = document.getElementById("calibration-screen")!;
  calScreen.style.display = "flex";

  const calStep = document.getElementById("cal-step")!;
  const calNoteEl = document.getElementById("cal-note")!;
  const calStatus = document.getElementById("cal-status")!;
  const calDetected = document.getElementById("cal-detected")!;
  const calProgress = document.getElementById("cal-progress")!;

  // Calibrate first octave of notes (up to 8 notes for a full tonic-to-tonic octave)
  const calNotes = music.notes.slice(0, 8);
  const totalSteps = calNotes.length;
  const noteOffsets = new Map<number, number>();

  let calRunning = true;
  const calInterval = setInterval(() => {
    if (!calRunning) return;
    pitch.update(audio);
    const r = pitch.lastResult;
    if (r) {
      // Find closest scale note to display solfege (raw MIDI may be off by 1 during calibration)
      let solfege: string = r.noteName;
      const exact = music.noteForMidi(r.midiNearest);
      if (exact) {
        solfege = exact.solfege;
      } else {
        const near = music.noteForMidi(r.midiNearest - 1) ?? music.noteForMidi(r.midiNearest + 1);
        if (near) solfege = near.solfege + "?";
      }
      calDetected.textContent = `${t("calHearing")} ${solfege} (${r.freq.toFixed(0)} Hz)`;
    } else {
      calDetected.textContent = t("calListening");
    }
    if (pitch.calibrationWaiting) {
      calProgress.style.width = "0%";
      calStatus.textContent = t("calWaiting");
    } else {
      calProgress.style.width = `${pitch.calibrationProgress * 100}%`;
      calStatus.textContent = t("calHoldSteady");
    }
  }, 50);

  for (let i = 0; i < totalSteps; i++) {
    const note = calNotes[i];
    calStep.textContent = `${t("calNote")} ${i + 1} / ${totalSteps}`;
    const prettyName = note.name.replace(/b/g, "♭").replace(/#/g, "♯");
    calNoteEl.textContent = `${note.solfege} (${prettyName})`;
    calProgress.style.width = "0%";
    calStatus.textContent = t("calWaiting");

    const avgMidi = await pitch.calibrateNote(note.midi);
    const offset = avgMidi - note.midi;
    noteOffsets.set(note.midi, offset);
    log("CAL_NOTE", { solfege: note.solfege, targetMidi: note.midi, avgMidi, offset });
  }

  calRunning = false;
  clearInterval(calInterval);

  pitch.setNoteOffsets(noteOffsets);
  log("CAL_DONE", { noteOffsets: Object.fromEntries(noteOffsets) });

  calScreen.style.display = "none";
}

function startSheetMode(): void {
  const container = document.getElementById("game-container")!;
  const renderer = new Renderer();

  // Show sheet-specific buttons
  document.getElementById("wait-toggle")!.style.display = "";

  renderer.init(container).then(() => {
    const game = new GameEngine(music);
    game.setGameWidth(renderer.width);

    pitch.setOnLock((note) => {
      const hit = game.tryHit(note.midi);
      log("LOCK", { midi: note.midi, noteName: note.noteName, hit: hit !== null });
    });

    const waitToggle = document.getElementById("wait-toggle")!;
    waitToggle.addEventListener("click", () => {
      const newMode = !game.waitMode;
      game.setWaitMode(newMode);
      waitToggle.textContent = newMode ? t("modeWait") : t("modeScroll");
    });

    let labelsOn = true;
    const labelsToggle = document.getElementById("labels-toggle")!;
    labelsToggle.addEventListener("click", () => {
      labelsOn = !labelsOn;
      renderer.showLabels = labelsOn;
      labelsToggle.textContent = labelsOn ? t("labelsOn") : t("labelsOff");
    });

    let hintsOn = true;
    const hintsToggle = document.getElementById("hints-toggle")!;
    hintsToggle.addEventListener("click", () => {
      hintsOn = !hintsOn;
      renderer.showFingering = hintsOn;
      hintsToggle.textContent = hintsOn ? t("hintsOn") : t("hintsOff");
    });

    let lastPitchLog = 0;
    const tickerCb = () => {
      if (paused) return;
      const dt = renderer.getTicker().deltaMS / 1000;
      const now = performance.now();

      pitch.update(audio);
      game.update(dt, now);
      renderer.render(game, pitch.lastResult, pitch.lockedNote, (midi) => music.noteForMidi(midi)?.solfege);

      const r = pitch.lastResult;
      if (r && now - lastPitchLog > 200) {
        lastPitchLog = now;
        log("PITCH", { freq: +r.freq.toFixed(1), midi: +r.midiFloat.toFixed(2), nearest: r.midiNearest, cents: +r.cents.toFixed(1), conf: +r.confidence.toFixed(2), note: r.noteName });
      }
    };

    renderer.getTicker().add(tickerCb);
    activeTicker = renderer.getTicker();
    activeTickerCb = tickerCb;
  });
}

function startBattleMode(): void {
  const currentKey = getSelectedKey();
  const container = document.getElementById("game-container")!;
  const battleRenderer = new BattleRenderer();

  // Hide sheet-specific buttons
  document.getElementById("wait-toggle")!.style.display = "none";

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
    });

    let hintsOn = true;
    const hintsToggle = document.getElementById("hints-toggle")!;
    hintsToggle.addEventListener("click", () => {
      hintsOn = !hintsOn;
      battleRenderer.showFingering = hintsOn;
      hintsToggle.textContent = hintsOn ? t("hintsOn") : t("hintsOff");
    });

    let lastPitchLog = 0;
    let scoreSaved = false;
    const tickerCb = () => {
      if (paused) return;
      const dt = battleRenderer.getTicker().deltaMS / 1000;
      const now = performance.now();

      pitch.update(audio);
      battle.update(dt, now);
      battleRenderer.render(battle, pitch.lastResult, pitch.lockedNote, (midi) => music.noteForMidi(midi)?.solfege);

      if (battle.gameOver && !scoreSaved) {
        scoreSaved = true;
        addScore(getPlayerName(), battle.currentScore, "battle", currentKey);
      }

      const r = pitch.lastResult;
      if (r && now - lastPitchLog > 200) {
        lastPitchLog = now;
        log("PITCH", { freq: +r.freq.toFixed(1), midi: +r.midiFloat.toFixed(2), nearest: r.midiNearest, cents: +r.cents.toFixed(1), conf: +r.confidence.toFixed(2), note: r.noteName });
      }
    };

    battleRenderer.getTicker().add(tickerCb);
    activeTicker = battleRenderer.getTicker();
    activeTickerCb = tickerCb;

    battleRenderer.onGoBack = goBack;
  });
}

function togglePause(): void {
  paused = !paused;
  document.getElementById("pause-overlay")!.style.display = paused ? "flex" : "none";
}

function goBack(): void {
  paused = false;
  document.getElementById("pause-overlay")!.style.display = "none";

  // Stop the active game loop
  if (activeTickerCb && activeTicker) {
    activeTicker.remove(activeTickerCb);
    activeTickerCb = null;
    activeTicker = null;
  }

  // Clear the game container canvas
  const container = document.getElementById("game-container")!;
  container.style.display = "none";
  // Remove the PixiJS canvas
  const canvas = container.querySelector("canvas");
  if (canvas) canvas.remove();

  pitch.setOnLock(null);
  started = false;

  // Rebuild UI and re-attach listeners
  buildUI();
  attachListeners();
}

async function startGame(): Promise<void> {
  if (started) return;

  const playerName = (document.getElementById("player-name") as HTMLInputElement).value.trim() || "Player";
  setPlayerName(playerName);

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
    // Full sopilka range: C–C–C (2 octaves)
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

  started = true;
  logInit();
  log("CONFIG", { tonic, mode, gameMode, lowMidi: SOPILKA_LOW, highMidi: highMidi, noteCount: music.notes.length });

  document.getElementById("start-screen")!.style.display = "none";

  const shouldCalibrate = (document.getElementById("calibrate-check") as HTMLInputElement).checked;
  if (shouldCalibrate) {
    await runCalibration();
  }

  paused = false;
  const container = document.getElementById("game-container")!;
  container.style.display = "block";
  document.getElementById("pause-overlay")!.style.display = "none";

  document.getElementById("pause-btn")!.addEventListener("click", togglePause);
  document.getElementById("resume-btn")!.addEventListener("click", togglePause);
  document.getElementById("exit-btn")!.addEventListener("click", goBack);

  if (gameMode === "battle") {
    startBattleMode();
  } else {
    startSheetMode();
  }
}

function attachListeners(): void {
  document.getElementById("tonic")!.addEventListener("change", refreshLeaderboard);
  document.getElementById("mode")!.addEventListener("change", refreshLeaderboard);

  document.getElementById("start-btn")!.addEventListener("click", startGame);

  document.getElementById("lang-btn")!.addEventListener("click", () => {
    const newLang: Lang = getLang() === "uk" ? "en" : "uk";
    setLang(newLang);
    buildUI();
    attachListeners();
  });
}

buildUI();
attachListeners();
