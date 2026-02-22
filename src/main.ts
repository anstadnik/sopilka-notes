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

const audio = new AudioEngine();
const pitch = new PitchEngine();
const music = new MusicEngine();

let started = false;
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
  if (entries.length === 0) return `<div id="leaderboard"><p class="hint">No scores yet for ${key}</p></div>`;
  const rows = entries
    .slice(0, 10)
    .map((e, i) => `<tr><td>${i + 1}</td><td>${e.name}</td><td>${e.score}</td><td>${e.mode}</td></tr>`)
    .join("");
  return `
    <div id="leaderboard">
      <h3>Leaderboard — ${key}</h3>
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Score</th><th>Mode</th></tr></thead>
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
  app.innerHTML = `
    <div id="start-screen">
      <h1>Sopilka Notes</h1>
      <div class="settings">
        <label>
          Player:
          <input id="player-name" type="text" placeholder="Your name" maxlength="20" value="${savedName}" />
        </label>
      </div>
      <div class="settings">
        <label>
          Key:
          <select id="tonic">
            <option>C</option><option>D</option><option>E</option><option>F</option>
            <option>G</option><option>A</option><option>B</option>
            <option>Db</option><option>Eb</option><option>Gb</option>
            <option>Ab</option><option>Bb</option>
          </select>
        </label>
        <label>
          Mode:
          <select id="mode">
            <option value="major">Major</option>
            <option value="minor">Minor</option>
          </select>
        </label>
        <label id="octaves-label" style="display:none">
          Octaves:
          <select id="octaves">
            <option value="1">1</option>
            <option value="2" selected>2</option>
          </select>
        </label>
      </div>
      <div class="settings">
        <label>
          Game:
          <select id="game-mode">
            <option value="sheet">Sheet Music</option>
            <option value="battle">Monster Defense</option>
          </select>
        </label>
      </div>
      <button id="start-btn">Start (enable mic)</button>
      <p class="hint">Play notes on your sopilka to hit the scrolling targets!</p>
      ${renderLeaderboard([], "C major")}
    </div>
    <div id="calibration-screen">
      <h2>Calibration</h2>
      <p id="cal-step">Note 1 / 8</p>
      <p id="cal-instruction">Play <strong id="cal-note">do</strong> and hold...</p>
      <p id="cal-status" class="hint">Waiting to hear the note...</p>
      <div class="progress-bar"><div id="cal-progress" class="progress-fill"></div></div>
      <p id="cal-detected">Listening...</p>
    </div>
    <div id="game-container">
      <button id="wait-toggle" class="game-btn" style="right:140px">Mode: Wait</button>
      <button id="labels-toggle" class="game-btn">Labels: On</button>
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

  const calNotes = music.notes.filter((n) => n.midi < SOPILKA_LOW + 13);
  const totalSteps = calNotes.length;
  const noteOffsets = new Map<number, number>();

  let calRunning = true;
  const calInterval = setInterval(() => {
    if (!calRunning) return;
    pitch.update(audio);
    const r = pitch.lastResult;
    if (r) {
      const solfege = music.noteForMidi(r.midiNearest)?.solfege ?? r.noteName;
      calDetected.textContent = `Hearing: ${solfege} (${r.freq.toFixed(0)} Hz)`;
    } else {
      calDetected.textContent = "Listening...";
    }
    if (pitch.calibrationWaiting) {
      calProgress.style.width = "0%";
      calStatus.textContent = "Waiting to hear the note...";
    } else {
      calProgress.style.width = `${pitch.calibrationProgress * 100}%`;
      calStatus.textContent = "Hold steady...";
    }
  }, 50);

  for (let i = 0; i < totalSteps; i++) {
    const note = calNotes[i];
    calStep.textContent = `Note ${i + 1} / ${totalSteps}`;
    calNoteEl.textContent = note.solfege;
    calProgress.style.width = "0%";
    calStatus.textContent = "Waiting to hear the note...";

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
      waitToggle.textContent = newMode ? "Mode: Wait" : "Mode: Scroll";
    });

    const labelsToggle = document.getElementById("labels-toggle")!;
    labelsToggle.addEventListener("click", () => {
      const show = labelsToggle.textContent === "Labels: Off";
      renderer.showLabels = show;
      labelsToggle.textContent = show ? "Labels: On" : "Labels: Off";
    });

    let lastPitchLog = 0;
    const tickerCb = () => {
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

    const labelsToggle = document.getElementById("labels-toggle")!;
    labelsToggle.addEventListener("click", () => {
      const show = labelsToggle.textContent === "Labels: Off";
      battleRenderer.showLabels = show;
      labelsToggle.textContent = show ? "Labels: On" : "Labels: Off";
    });

    let lastPitchLog = 0;
    let scoreSaved = false;
    const tickerCb = () => {
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

function goBack(): void {
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
  const isCmaj = tonic === "C" && mode === "major";
  const octaves = isCmaj ? parseInt((document.getElementById("octaves") as HTMLSelectElement).value) : 1;
  const highMidi = SOPILKA_LOW + octaves * 12;

  music.setKey(tonic, mode);
  music.setRange(SOPILKA_LOW, highMidi);

  if (music.notes.length === 0) {
    alert("No notes in this key/range. Try a different key.");
    return;
  }

  try {
    await audio.start();
  } catch (e) {
    alert("Could not access microphone. Please allow mic access and reload.");
    console.error(e);
    return;
  }

  started = true;
  logInit();
  log("CONFIG", { tonic, mode, gameMode, lowMidi: SOPILKA_LOW, highMidi: highMidi, noteCount: music.notes.length });

  document.getElementById("start-screen")!.style.display = "none";

  // await runCalibration();

  const container = document.getElementById("game-container")!;
  container.style.display = "block";

  if (gameMode === "battle") {
    startBattleMode();
  } else {
    startSheetMode();
  }
}

function attachListeners(): void {
  // Show octaves selector only for C major
  function updateOctavesVisibility(): void {
    const tonic = (document.getElementById("tonic") as HTMLSelectElement).value;
    const mode = (document.getElementById("mode") as HTMLSelectElement).value;
    const label = document.getElementById("octaves-label")!;
    label.style.display = (tonic === "C" && mode === "major") ? "" : "none";
  }

  document.getElementById("tonic")!.addEventListener("change", () => { updateOctavesVisibility(); refreshLeaderboard(); });
  document.getElementById("mode")!.addEventListener("change", () => { updateOctavesVisibility(); refreshLeaderboard(); });
  updateOctavesVisibility();

  document.getElementById("start-btn")!.addEventListener("click", startGame);
}

buildUI();
attachListeners();
