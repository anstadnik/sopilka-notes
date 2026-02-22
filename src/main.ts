import "./style.css";
import { AudioEngine } from "./audio/AudioEngine.ts";
import { PitchEngine } from "./audio/PitchEngine.ts";
import { MusicEngine } from "./music/MusicEngine.ts";
import { GameEngine } from "./game/GameEngine.ts";
import { Renderer } from "./render/Renderer.ts";
import { logInit, log, downloadLog } from "./debug/logger.ts";

const audio = new AudioEngine();
const pitch = new PitchEngine();
const music = new MusicEngine();
const renderer = new Renderer();

let game: GameEngine;
let started = false;

// Sopilka physical range starts at C5
const SOPILKA_LOW = 72; // C5

function buildUI(): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = `
    <div id="start-screen">
      <h1>Sopilka Notes</h1>
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
      <button id="start-btn">Start (enable mic)</button>
      <p class="hint">Play notes on your sopilka to hit the scrolling targets!</p>
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
      <button id="wait-toggle" class="game-btn" style="right:260px">Mode: Wait</button>
      <button id="labels-toggle" class="game-btn" style="right:140px">Labels: On</button>
      <button id="save-log" class="game-btn">Save Log</button>
    </div>
  `;
}

async function startGame(): Promise<void> {
  if (started) return;

  const tonic = (document.getElementById("tonic") as HTMLSelectElement).value;
  const mode = (document.getElementById("mode") as HTMLSelectElement).value as "major" | "minor";
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
  log("CONFIG", { tonic, mode, lowMidi: SOPILKA_LOW, highMidi: highMidi, noteCount: music.notes.length });

  document.getElementById("start-screen")!.style.display = "none";

  // Per-note calibration
  const calScreen = document.getElementById("calibration-screen")!;
  calScreen.style.display = "flex";

  const calStep = document.getElementById("cal-step")!;
  const calNoteEl = document.getElementById("cal-note")!;
  const calStatus = document.getElementById("cal-status")!;
  const calDetected = document.getElementById("cal-detected")!;
  const calProgress = document.getElementById("cal-progress")!;

  // Get the first octave of scale notes for calibration
  const calNotes = music.notes.filter((n) => n.midi < SOPILKA_LOW + 13);
  const totalSteps = calNotes.length;
  const noteOffsets = new Map<number, number>();

  // Pump pitch continuously during calibration
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

  // Walk through each note
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

  // Hide calibration
  calScreen.style.display = "none";
  const container = document.getElementById("game-container")!;
  container.style.display = "block";

  await renderer.init(container);

  game = new GameEngine(music);
  game.setGameWidth(renderer.width);

  pitch.setOnLock((note) => {
    const hit = game.tryHit(note.midi);
    log("LOCK", { midi: note.midi, noteName: note.noteName, hit: hit !== null });
  });

  // Wait/Scroll toggle
  const waitToggle = document.getElementById("wait-toggle")!;
  waitToggle.addEventListener("click", () => {
    const newMode = !game.waitMode;
    game.setWaitMode(newMode);
    waitToggle.textContent = newMode ? "Mode: Wait" : "Mode: Scroll";
  });

  // Labels toggle
  const labelsToggle = document.getElementById("labels-toggle")!;
  labelsToggle.addEventListener("click", () => {
    const show = labelsToggle.textContent === "Labels: Off";
    renderer.showLabels = show;
    labelsToggle.textContent = show ? "Labels: On" : "Labels: Off";
  });

  // Save Log button
  document.getElementById("save-log")!.addEventListener("click", downloadLog);

  // Game loop — log raw pitch every ~200ms
  let lastPitchLog = 0;
  renderer.getTicker().add(() => {
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
  });
}

buildUI();

// Show octaves selector only for C major
function updateOctavesVisibility(): void {
  const tonic = (document.getElementById("tonic") as HTMLSelectElement).value;
  const mode = (document.getElementById("mode") as HTMLSelectElement).value;
  const label = document.getElementById("octaves-label")!;
  label.style.display = (tonic === "C" && mode === "major") ? "" : "none";
}

document.getElementById("tonic")!.addEventListener("change", updateOctavesVisibility);
document.getElementById("mode")!.addEventListener("change", updateOctavesVisibility);
updateOctavesVisibility();

document.getElementById("start-btn")!.addEventListener("click", startGame);
