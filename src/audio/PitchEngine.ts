import { PitchDetector } from "pitchy";
import type { AudioEngine } from "./AudioEngine.ts";

export interface PitchResult {
  freq: number;
  midiFloat: number;
  midiNearest: number;
  cents: number;
  confidence: number;
  noteName: string;
}

export interface LockedNote {
  midi: number;
  noteName: string;
}

const NOTE_NAMES = [
  "C", "C#", "D", "D#", "E", "F",
  "F#", "G", "G#", "A", "A#", "B",
];

const CONFIDENCE_THRESHOLD = 0.80;
const LOCK_FRAMES = 8;
const CENTS_WINDOW = 35;
const CAL_SAMPLES_NEEDED = 15;

type CalState = {
  targetMidi: number;
  samples: number[];
  phase: "gap" | "waiting" | "collecting"; // gap = need silence/different note first
  resolve: (avgMidi: number) => void;
};

export class PitchEngine {
  private detector: PitchDetector<Float32Array> | null = null;
  private history: (PitchResult | null)[] = [];
  private _lockedNote: LockedNote | null = null;
  private _lastResult: PitchResult | null = null;
  private onLock: ((note: LockedNote) => void) | null = null;
  private prevLockedMidi: number | null = null;
  private _noteOffsets: Map<number, number> = new Map(); // midi -> offset in semitones
  private _cal: CalState | null = null;

  setOnLock(cb: (note: LockedNote) => void): void {
    this.onLock = cb;
  }

  get lockedNote(): LockedNote | null {
    return this._lockedNote;
  }

  get lastResult(): PitchResult | null {
    return this._lastResult;
  }

  setNoteOffsets(offsets: Map<number, number>): void {
    this._noteOffsets = offsets;
  }

  /** Get the offset for a given raw MIDI by finding the closest calibrated note (with octave extrapolation). */
  private getOffset(rawMidiNearest: number): number {
    if (this._noteOffsets.size === 0) return 0;
    // Try exact match first
    if (this._noteOffsets.has(rawMidiNearest)) return this._noteOffsets.get(rawMidiNearest)!;
    // Try same pitch class in other octaves
    const pc = ((rawMidiNearest % 12) + 12) % 12;
    for (const [midi, offset] of this._noteOffsets) {
      if (((midi % 12) + 12) % 12 === pc) return offset;
    }
    // Fall back to nearest calibrated note
    let bestDist = Infinity;
    let bestOffset = 0;
    for (const [midi, offset] of this._noteOffsets) {
      const dist = Math.abs(midi - rawMidiNearest);
      if (dist < bestDist) {
        bestDist = dist;
        bestOffset = offset;
      }
    }
    return bestOffset;
  }

  get isCalibrating(): boolean {
    return this._cal !== null;
  }

  get calibrationWaiting(): boolean {
    return this._cal?.phase !== "collecting";
  }

  get calibrationProgress(): number {
    if (!this._cal) return 0;
    if (this._cal.phase !== "collecting") return 0;
    return Math.min(this._cal.samples.length / CAL_SAMPLES_NEEDED, 1);
  }

  /** Calibrate a single note. Returns the average raw MIDI measured. */
  calibrateNote(targetMidi: number): Promise<number> {
    // Start in "gap" phase — must hear silence or a note far from target before collecting
    return new Promise((resolve) => {
      this._cal = { targetMidi, samples: [], phase: "gap", resolve };
    });
  }

  update(audio: AudioEngine): void {
    const buf = audio.getBuffer();
    if (!this.detector || this.detector.inputLength !== buf.length) {
      this.detector = PitchDetector.forFloat32Array(buf.length);
    }

    const [freq, confidence] = this.detector.findPitch(buf, audio.sampleRate);

    if (confidence < CONFIDENCE_THRESHOLD || freq < 50) {
      this._lastResult = null;
      this.history.push(null);
      if (this.history.length > LOCK_FRAMES) this.history.shift();
      if (this._cal) {
        // Silence counts as "not playing the previous note" — advance past gap
        if (this._cal.phase === "gap") this._cal.phase = "waiting";
      } else {
        this._lockedNote = null;
        this.prevLockedMidi = null;
      }
      return;
    }

    const rawMidiFloat = 69 + 12 * Math.log2(freq / 440);
    const rawNearest = Math.round(rawMidiFloat);
    const rawNoteName = NOTE_NAMES[((rawNearest % 12) + 12) % 12];
    const rawOctave = Math.floor(rawNearest / 12) - 1;

    this._lastResult = {
      freq,
      midiFloat: rawMidiFloat,
      midiNearest: rawNearest,
      cents: (rawMidiFloat - rawNearest) * 100,
      confidence,
      noteName: rawNoteName + rawOctave,
    };

    // Calibration mode
    if (this._cal) {
      const cal = this._cal;
      const nearTarget = Math.abs(rawNearest - cal.targetMidi) <= 1;

      if (cal.phase === "gap") {
        // Wait until the player stops playing the previous note
        if (!nearTarget) {
          cal.phase = "waiting";
        }
      }
      if (cal.phase === "waiting") {
        // Now wait for the target note to appear
        if (nearTarget) {
          cal.phase = "collecting";
        }
      }
      if (cal.phase === "collecting") {
        if (nearTarget) {
          cal.samples.push(rawMidiFloat);
        }
        if (cal.samples.length >= CAL_SAMPLES_NEEDED) {
          const avg = cal.samples.reduce((a, b) => a + b, 0) / cal.samples.length;
          const resolve = cal.resolve;
          this._cal = null;
          resolve(avg);
        }
      }
      return;
    }

    // Normal mode: apply per-note offset
    const offset = this.getOffset(rawNearest);
    const midiFloat = rawMidiFloat - offset;
    const midiNearest = Math.round(midiFloat);
    const cents = (midiFloat - midiNearest) * 100;
    const noteName = NOTE_NAMES[((midiNearest % 12) + 12) % 12];
    const octave = Math.floor(midiNearest / 12) - 1;

    const result: PitchResult = {
      freq,
      midiFloat,
      midiNearest,
      cents,
      confidence,
      noteName: noteName + octave,
    };

    this._lastResult = result;
    this.history.push(result);
    if (this.history.length > LOCK_FRAMES) this.history.shift();

    this.checkLock();
  }

  private checkLock(): void {
    if (this.history.length < LOCK_FRAMES) {
      this._lockedNote = null;
      return;
    }

    const recent = this.history.slice(-LOCK_FRAMES);
    const validResults = recent.filter((r): r is PitchResult => r !== null);

    if (validResults.length < LOCK_FRAMES - 1) {
      this._lockedNote = null;
      this.prevLockedMidi = null;
      return;
    }

    const targetMidi = validResults[0].midiNearest;
    const allMatch = validResults.every(
      (r) => r.midiNearest === targetMidi && Math.abs(r.cents) < CENTS_WINDOW
    );

    if (allMatch) {
      const noteName = validResults[0].noteName;
      this._lockedNote = { midi: targetMidi, noteName };

      if (this.prevLockedMidi !== targetMidi) {
        this.prevLockedMidi = targetMidi;
        this.onLock?.({ midi: targetMidi, noteName });
      }
    } else {
      this._lockedNote = null;
      this.prevLockedMidi = null;
    }
  }
}
