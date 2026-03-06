import "./style.css";
import { AudioEngine } from "./audio/AudioEngine.ts";
import { PitchEngine } from "./audio/PitchEngine.ts";
import { MusicEngine } from "./music/MusicEngine.ts";
import { GameEngine } from "./game/GameEngine.ts";
import { BattleEngine } from "./game/BattleEngine.ts";
import { Renderer } from "./render/Renderer.ts";
import { BattleRenderer } from "./render/BattleRenderer.ts";
import { RhythmEngine } from "./game/RhythmEngine.ts";
import type { Complexity, Tolerance } from "./game/RhythmEngine.ts";
import { RhythmRenderer } from "./render/RhythmRenderer.ts";
import { Metronome } from "./audio/Metronome.ts";
import { logInit, log } from "./debug/logger.ts";
import { getPlayerName, setPlayerName, addScore, getLeaderboard } from "./leaderboard.ts";
import { t, getLang, setLang, type Lang, type TranslationKey } from "./i18n.ts";

const audio = new AudioEngine();
const pitch = new PitchEngine();
const music = new MusicEngine();

let started = false;
let paused = false;
let activeTickerCb: (() => void) | null = null;
let activeTicker: { remove(fn: () => void): void } | null = null;
let gameAbortController: AbortController | null = null;

// Sopilka physical range starts at C5
const SOPILKA_LOW = 72; // C5

// localStorage keys for menu state persistence
const LS_TONIC = "sopilka-tonic";
const LS_MODE = "sopilka-mode";
const LS_GAME_MODE = "sopilka-game-mode";
const LS_FULL_RANGE = "sopilka-full-range";
const LS_CALIBRATE = "sopilka-calibrate";
const LS_COMPETE = "sopilka-compete";
const LS_SESSION_LENGTH = "sopilka-session-length";
const LS_RHYTHM_BPM = "sopilka-rhythm-bpm";
const LS_RHYTHM_COMPLEXITY = "sopilka-rhythm-complexity";
const LS_RHYTHM_TOLERANCE = "sopilka-rhythm-tolerance";

function getSavedTonic(): string { return localStorage.getItem(LS_TONIC) || "C"; }
function getSavedMode(): string { return localStorage.getItem(LS_MODE) || "major"; }
function getSavedGameMode(): string { return localStorage.getItem(LS_GAME_MODE) || "battle"; }
function getSavedFullRange(): boolean { const v = localStorage.getItem(LS_FULL_RANGE); return v === null ? false : v === "true"; }
function getSavedCalibrate(): boolean { return localStorage.getItem(LS_CALIBRATE) === "true"; }
function getSavedSessionLength(): number { return parseInt(localStorage.getItem(LS_SESSION_LENGTH) || "0", 10); }
function isCompeteMode(): boolean { return localStorage.getItem(LS_COMPETE) === "true"; }
function setCompeteMode(on: boolean): void { localStorage.setItem(LS_COMPETE, on ? "true" : "false"); }
function getSavedRhythmBpm(): number { return parseInt(localStorage.getItem(LS_RHYTHM_BPM) || "80", 10); }
function getSavedRhythmComplexity(): Complexity { return (localStorage.getItem(LS_RHYTHM_COMPLEXITY) as Complexity) || "easy"; }
function getSavedRhythmTolerance(): Tolerance { return (localStorage.getItem(LS_RHYTHM_TOLERANCE) as Tolerance) || "normal"; }

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
  const savedTonic = getSavedTonic();
  const savedMode = getSavedMode();
  const savedGameMode = getSavedGameMode();
  const competing = isCompeteMode();
  const otherLang: Lang = getLang() === "uk" ? "en" : "uk";
  const langLabel = otherLang === "en" ? "\u{1F1EC}\u{1F1E7}" : "\u{1F1FA}\u{1F1E6}";
  const TONICS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const TONIC_LABELS: Record<string, string> = {
    "C": "До", "Db": "Ре♭", "D": "Ре", "Eb": "Мі♭", "E": "Мі", "F": "Фа",
    "Gb": "Соль♭", "G": "Соль", "Ab": "Ля♭", "A": "Ля", "Bb": "Сі♭", "B": "Сі",
  };
  const tonicOptions = TONICS.map(n => `<option value="${n}"${n === savedTonic ? " selected" : ""}>${TONIC_LABELS[n]}</option>`).join("");
  const savedKey = `${savedTonic} ${savedMode}`;
  app.innerHTML = `
    <div id="start-screen">
      <div class="title-row">
        <h1 data-i18n="title">${t("title")}</h1>
        <button id="help-btn" class="title-icon-btn" aria-label="Help">?</button>
        <button id="lang-btn" class="title-icon-btn">${langLabel}</button>
      </div>
      <div class="settings-primary">
        <label>
          ${t("key")}
          <select id="tonic">
            ${tonicOptions}
          </select>
        </label>
        <label>
          ${t("mode")}
          <select id="mode">
            <option value="major"${savedMode === "major" ? " selected" : ""}>${t("major")}</option>
            <option value="minor"${savedMode === "minor" ? " selected" : ""}>${t("minor")}</option>
          </select>
        </label>
        <label>
          ${t("game")}
          <select id="game-mode">
            <option value="battle"${savedGameMode === "battle" ? " selected" : ""}>${t("monsterDefense")}</option>
            <option value="sheet"${savedGameMode === "sheet" ? " selected" : ""}>${t("sheetMusic")}</option>
            <option value="rhythm"${savedGameMode === "rhythm" ? " selected" : ""}>${t("rhythm")}</option>
          </select>
        </label>
      </div>
      <details class="settings-advanced"${competing ? " open" : ""}>
        <summary data-i18n="advancedSettings">${t("advancedSettings")}</summary>
        <div class="settings-advanced-content">
          <label id="all-notes-label">
            <input id="all-notes-check" type="checkbox" ${getSavedFullRange() ? "checked" : ""} />
            ${t("fullRange")}
          </label>
          <div id="session-length-row" style="display: ${savedGameMode === "sheet" || savedGameMode === "rhythm" ? "" : "none"}">
            <label>
              ${t("sessionLength")}
              <select id="session-length">
                <option value="0"${getSavedSessionLength() === 0 ? " selected" : ""}>${t("endless")}</option>
                <option value="20"${getSavedSessionLength() === 20 ? " selected" : ""}>20</option>
                <option value="50"${getSavedSessionLength() === 50 ? " selected" : ""}>50</option>
                <option value="100"${getSavedSessionLength() === 100 ? " selected" : ""}>100</option>
              </select>
            </label>
          </div>
          <div id="rhythm-settings" style="display: ${savedGameMode === "rhythm" ? "" : "none"}">
            <label>
              ${t("bpm")}
              <select id="rhythm-bpm">
                <option value="60"${getSavedRhythmBpm() === 60 ? " selected" : ""}>60</option>
                <option value="80"${getSavedRhythmBpm() === 80 ? " selected" : ""}>80</option>
                <option value="100"${getSavedRhythmBpm() === 100 ? " selected" : ""}>100</option>
                <option value="120"${getSavedRhythmBpm() === 120 ? " selected" : ""}>120</option>
              </select>
            </label>
            <label>
              ${t("complexity")}
              <select id="rhythm-complexity">
                <option value="easy"${getSavedRhythmComplexity() === "easy" ? " selected" : ""}>${t("complexityEasy")}</option>
                <option value="medium"${getSavedRhythmComplexity() === "medium" ? " selected" : ""}>${t("complexityMedium")}</option>
                <option value="hard"${getSavedRhythmComplexity() === "hard" ? " selected" : ""}>${t("complexityHard")}</option>
              </select>
            </label>
            <label>
              ${t("tolerance")}
              <select id="rhythm-tolerance">
                <option value="loose"${getSavedRhythmTolerance() === "loose" ? " selected" : ""}>${t("toleranceLoose")}</option>
                <option value="normal"${getSavedRhythmTolerance() === "normal" ? " selected" : ""}>${t("toleranceNormal")}</option>
                <option value="tight"${getSavedRhythmTolerance() === "tight" ? " selected" : ""}>${t("toleranceTight")}</option>
              </select>
            </label>
          </div>
          <label>
            <input id="calibrate-check" type="checkbox" ${getSavedCalibrate() ? "checked" : ""} />
            ${t("enableCalibration")}
          </label>
          <p class="hint">${t("calibrationHint")}</p>
          <button id="compete-btn" class="compete-btn">${t("compete")}${competing ? " \u2713" : ""}</button>
          <div id="compete-section" style="display: ${competing ? "contents" : "none"}">
            <label>
              ${t("player")}
              <input id="player-name" type="text" placeholder="${t("playerPlaceholder")}" maxlength="20" value="${savedName}" />
            </label>
            <p class="hint">${t("competeHint")}</p>
            ${renderLeaderboard([], savedKey)}
          </div>
        </div>
      </details>
      <button id="start-btn" data-i18n="startBtn">${t("startBtn")}</button>
      <p class="hint" data-i18n="startHint">${t("startHint")}</p>
    </div>
    <div id="help-overlay">
      <div class="help-modal">
        <h2>${t("helpTitle")}</h2>
        <div class="help-body">
          <p>${t("helpIntro")}</p>
          <h3>${t("helpSettingsTitle")}</h3>
          <ul>
            <li>${t("helpKeyDesc")}</li>
            <li>${t("helpModeDesc")}</li>
            <li>${t("helpFullRangeDesc")}</li>
            <li>${t("helpCalibrationDesc")}</li>
            <li>${t("helpCompeteDesc")}</li>
          </ul>
          <h3>${t("helpSheetTitle")}</h3>
          <p>${t("helpSheetDesc")}</p>
          <h3>${t("helpBattleTitle")}</h3>
          <p>${t("helpBattleDesc")}</p>
          <h3>${t("helpRhythmTitle")}</h3>
          <p>${t("helpRhythmDesc")}</p>
          <h3>${t("helpInGameTitle")}</h3>
          <ul>
            <li>${t("helpPauseDesc")}</li>
            <li>${t("helpWaitToggleDesc")}</li>
            <li>${t("helpLabelsDesc")}</li>
            <li>${t("helpHintsDesc")}</li>
          </ul>
        </div>
        <button id="help-close-btn">${t("helpClose")}</button>
      </div>
    </div>
    <div id="loading-screen">
      <div class="loading-spinner"></div>
      <p>${t("loading")}</p>
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
          <button id="clean-toggle" class="game-btn" style="display:none">${t("cleanOff")}</button>
          <button id="strict-toggle" class="game-btn" style="display:none">${t("strictOff")}</button>
          <button id="labels-toggle" class="game-btn">${t("labelsOn")}</button>
          <button id="hints-toggle" class="game-btn">${t("hintsOn")}</button>
        </div>
      </div>
      <div id="pause-overlay">
        <h2>${t("paused")}</h2>
        <button id="resume-btn" class="pause-menu-btn">${t("resume")}</button>
        <button id="exit-btn" class="pause-menu-btn exit">${t("exitToMenu")}</button>
      </div>
      <div id="esc-hint" class="esc-hint">${t("escHint")}</div>
      <div id="results-overlay">
        <h2>${t("sessionComplete")}</h2>
        <div class="results-stats">
          <p id="results-hit"></p>
          <p id="results-missed"></p>
          <p id="results-accuracy"></p>
          <p id="results-combo"></p>
          <p id="results-score"></p>
        </div>
        <button id="results-exit-btn" class="pause-menu-btn">${t("exitToMenu")}</button>
      </div>
    </div>
  `;

  // Load leaderboard asynchronously (only when competing)
  if (competing) refreshLeaderboard();
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

    let lastPitchLog = 0;
    let sessionShown = false;
    const tickerCb = () => {
      if (paused) return;
      const dt = renderer.getTicker().deltaMS / 1000;
      const now = performance.now();

      pitch.update(audio);
      game.setGameWidth(renderer.width);
      game.update(dt, now);
      renderer.render(game, pitch.lastResult, pitch.lockedNote, (midi) => music.noteForMidi(midi)?.solfege);

      if ((game.sessionDone || game.gameOver) && !sessionShown) {
        sessionShown = true;
        showResults(game, signal);
      }

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

function showResults(game: GameEngine | RhythmEngine, signal: AbortSignal): void {
  const overlay = document.getElementById("results-overlay")!;
  const total = game.totalHit + game.totalMissed;
  const accuracy = total > 0 ? ((game.totalHit / total) * 100).toFixed(1) : "0";
  document.getElementById("results-hit")!.textContent = `${t("notesHit")}: ${game.totalHit}`;
  document.getElementById("results-missed")!.textContent = `${t("notesMissed")}: ${game.totalMissed}`;
  document.getElementById("results-accuracy")!.textContent = `${t("accuracy")}: ${accuracy}%`;
  document.getElementById("results-combo")!.textContent = `${t("longestCombo")}: ${game.maxCombo}`;
  document.getElementById("results-score")!.textContent = `${t("score")} ${game.currentScore}`;
  overlay.style.display = "flex";
  document.getElementById("results-exit-btn")!.addEventListener("click", goBack, { signal });
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

    let lastPitchLog = 0;
    let scoreSaved = false;
    const tickerCb = () => {
      if (paused) return;
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
    activeTicker = battleRenderer.getTicker();
    activeTickerCb = tickerCb;

    battleRenderer.onGoBack = goBack;
  });
}

let activeMetronome: Metronome | null = null;

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
    activeMetronome = metronome;

    // Start metronome using audio engine's context
    const audioCtx = audio.getContext();
    if (audioCtx) {
      metronome.start(audioCtx);
    }

    // No onLock needed — rhythm mode polls pitch state each frame

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

    let lastPitchLog = 0;
    let sessionShown = false;
    const tickerCb = () => {
      if (paused) return;
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
        showResults(game, signal);
      }

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

function togglePause(): void {
  paused = !paused;
  document.getElementById("pause-overlay")!.style.display = paused ? "flex" : "none";
}

function goBack(): void {
  paused = false;
  document.getElementById("pause-overlay")!.style.display = "none";

  gameAbortController?.abort();
  gameAbortController = null;

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
  if (activeMetronome) {
    activeMetronome.stop();
    activeMetronome = null;
  }
  started = false;

  // Rebuild UI and re-attach listeners
  buildUI();
  attachListeners();
}

async function startGame(): Promise<void> {
  if (started) return;

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
  document.getElementById("loading-screen")!.style.display = "flex";

  const shouldCalibrate = (document.getElementById("calibrate-check") as HTMLInputElement).checked;
  if (shouldCalibrate) {
    document.getElementById("loading-screen")!.style.display = "none";
    await runCalibration();
  }

  paused = false;
  document.getElementById("loading-screen")!.style.display = "none";
  const container = document.getElementById("game-container")!;
  container.style.display = "block";
  document.getElementById("pause-overlay")!.style.display = "none";
  document.getElementById("results-overlay")!.style.display = "none";

  // Show ESC hint briefly
  const escHint = document.getElementById("esc-hint")!;
  escHint.style.display = "block";
  escHint.style.opacity = "1";
  setTimeout(() => {
    escHint.style.opacity = "0";
    setTimeout(() => { escHint.style.display = "none"; }, 1000);
  }, 3000);

  gameAbortController?.abort();
  gameAbortController = new AbortController();
  const signal = gameAbortController.signal;

  document.getElementById("pause-btn")!.addEventListener("click", togglePause, { signal });
  document.getElementById("resume-btn")!.addEventListener("click", togglePause, { signal });
  document.getElementById("exit-btn")!.addEventListener("click", goBack, { signal });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && started) {
      e.preventDefault();
      togglePause();
    }
  }, { signal });

  if (gameMode === "battle") {
    startBattleMode(signal);
  } else if (gameMode === "rhythm") {
    startRhythmMode(signal);
  } else {
    startSheetMode(signal);
  }
}

function updateAllTranslations(): void {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n") as TranslationKey;
    el.textContent = t(key);
  });

  // Language button
  const otherLang: Lang = getLang() === "uk" ? "en" : "uk";
  const langLabel = otherLang === "en" ? "\u{1F1EC}\u{1F1E7}" : "\u{1F1FA}\u{1F1E6}";
  document.getElementById("lang-btn")!.textContent = langLabel;

  // Compete button (has checkmark)
  const competeBtn = document.getElementById("compete-btn");
  if (competeBtn) {
    competeBtn.textContent = t("compete") + (isCompeteMode() ? " \u2713" : "");
  }

  // Select option texts
  const modeEl = document.getElementById("mode") as HTMLSelectElement | null;
  if (modeEl) {
    modeEl.options[0].textContent = t("major");
    modeEl.options[1].textContent = t("minor");
  }
  const gameModeEl = document.getElementById("game-mode") as HTMLSelectElement | null;
  if (gameModeEl) {
    gameModeEl.options[0].textContent = t("monsterDefense");
    gameModeEl.options[1].textContent = t("sheetMusic");
    gameModeEl.options[2].textContent = t("rhythm");
  }
  const sessionLengthEl = document.getElementById("session-length") as HTMLSelectElement | null;
  if (sessionLengthEl) {
    sessionLengthEl.options[0].textContent = t("endless");
  }
}

function attachListeners(): void {
  const tonicEl = document.getElementById("tonic") as HTMLSelectElement;
  const modeEl = document.getElementById("mode") as HTMLSelectElement;
  const gameModeEl = document.getElementById("game-mode") as HTMLSelectElement;
  const fullRangeEl = document.getElementById("all-notes-check") as HTMLInputElement;
  const calibrateEl = document.getElementById("calibrate-check") as HTMLInputElement;

  tonicEl.addEventListener("change", () => {
    localStorage.setItem(LS_TONIC, tonicEl.value);
    if (isCompeteMode()) refreshLeaderboard();
  });
  modeEl.addEventListener("change", () => {
    localStorage.setItem(LS_MODE, modeEl.value);
    if (isCompeteMode()) refreshLeaderboard();
  });
  gameModeEl.addEventListener("change", () => {
    localStorage.setItem(LS_GAME_MODE, gameModeEl.value);
    const isSheetOrRhythm = gameModeEl.value === "sheet" || gameModeEl.value === "rhythm";
    document.getElementById("session-length-row")!.style.display = isSheetOrRhythm ? "" : "none";
    document.getElementById("rhythm-settings")!.style.display = gameModeEl.value === "rhythm" ? "" : "none";
  });
  const sessionLengthEl = document.getElementById("session-length") as HTMLSelectElement;
  sessionLengthEl.addEventListener("change", () => { localStorage.setItem(LS_SESSION_LENGTH, sessionLengthEl.value); });
  fullRangeEl.addEventListener("change", () => { localStorage.setItem(LS_FULL_RANGE, String(fullRangeEl.checked)); });
  calibrateEl.addEventListener("change", () => { localStorage.setItem(LS_CALIBRATE, String(calibrateEl.checked)); });
  const rhythmBpmEl = document.getElementById("rhythm-bpm") as HTMLSelectElement;
  rhythmBpmEl.addEventListener("change", () => { localStorage.setItem(LS_RHYTHM_BPM, rhythmBpmEl.value); });
  const rhythmComplexityEl = document.getElementById("rhythm-complexity") as HTMLSelectElement;
  rhythmComplexityEl.addEventListener("change", () => { localStorage.setItem(LS_RHYTHM_COMPLEXITY, rhythmComplexityEl.value); });
  const rhythmToleranceEl = document.getElementById("rhythm-tolerance") as HTMLSelectElement;
  rhythmToleranceEl.addEventListener("change", () => { localStorage.setItem(LS_RHYTHM_TOLERANCE, rhythmToleranceEl.value); });

  document.getElementById("compete-btn")!.addEventListener("click", () => {
    const nowCompeting = !isCompeteMode();
    setCompeteMode(nowCompeting);
    const section = document.getElementById("compete-section")!;
    const btn = document.getElementById("compete-btn")!;
    if (nowCompeting) {
      section.style.display = "contents";
      btn.textContent = t("compete") + " \u2713";
      refreshLeaderboard();
    } else {
      section.style.display = "none";
      btn.textContent = t("compete");
    }
  });

  document.getElementById("start-btn")!.addEventListener("click", startGame);

  const helpOverlay = document.getElementById("help-overlay")!;
  document.getElementById("help-btn")!.addEventListener("click", () => {
    helpOverlay.style.display = "flex";
  });
  document.getElementById("help-close-btn")!.addEventListener("click", () => {
    helpOverlay.style.display = "none";
  });
  helpOverlay.addEventListener("click", (e) => {
    if (e.target === helpOverlay) helpOverlay.style.display = "none";
  });

  document.getElementById("lang-btn")!.addEventListener("click", () => {
    const newLang: Lang = getLang() === "uk" ? "en" : "uk";
    setLang(newLang);
    updateAllTranslations();
  });
}

buildUI();
attachListeners();
