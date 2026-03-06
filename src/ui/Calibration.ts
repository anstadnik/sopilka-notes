import type { AudioEngine } from "../audio/AudioEngine.ts";
import type { PitchEngine } from "../audio/PitchEngine.ts";
import type { MusicEngine } from "../music/MusicEngine.ts";
import { log } from "../debug/logger.ts";
import { t } from "../i18n.ts";

export async function runCalibration(audio: AudioEngine, pitch: PitchEngine, music: MusicEngine): Promise<void> {
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
    const prettyName = note.name.replace(/b/g, "\u266D").replace(/#/g, "\u266F");
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
