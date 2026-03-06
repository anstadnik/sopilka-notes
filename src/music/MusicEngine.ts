import { Scale, Note } from "@tonaljs/tonal";

export interface ScaleNote {
  midi: number;
  name: string;
  solfege: string;
  accidental: string; // "" | "♭" | "♯"
  staffPosition: number; // 0 = bottom line (E5), +1 = first space (F5), etc.
}

// E5 = bottom staff line (position 0), so C5 sits at position -2 (1st ledger line below)
const REFERENCE_DIATONIC = 37; // E5 in diatonic space (C0=0, D0=1, ... E5=5*7+2=37)

// Fixed do: C=do, D=re, E=mi, F=fa, G=sol, A=la, B=ti
const FIXED_SOLFEGE: Record<string, string> = {
  "C": "do", "D": "re", "E": "mi", "F": "fa", "G": "sol", "A": "la", "B": "ti",
};

function midiToDiatonic(_midi: number, noteName: string): number {
  const letter = noteName.charAt(0);
  const octave = Note.octave(noteName) ?? 4;
  const letterIndex = "CDEFGAB".indexOf(letter);
  return octave * 7 + letterIndex;
}

export class MusicEngine {
  private _tonic = "C";
  private _mode: "major" | "minor" = "major";
  private _lowMidi = 60;  // C4
  private _highMidi = 84; // C6
  private _notes: ScaleNote[] = [];

  get tonic(): string {
    return this._tonic;
  }

  get mode(): "major" | "minor" {
    return this._mode;
  }

  get notes(): ScaleNote[] {
    return this._notes;
  }

  setKey(tonic: string, mode: "major" | "minor"): void {
    this._tonic = tonic;
    this._mode = mode;
    this.rebuild();
  }

  setRange(lowMidi: number, highMidi: number): void {
    this._lowMidi = lowMidi;
    this._highMidi = highMidi;
    this.rebuild();
  }

  private rebuild(): void {
    const scaleName = `${this._tonic} ${this._mode}`;
    const scale = Scale.get(scaleName);
    if (!scale.notes.length) return;

    const scaleNotes: ScaleNote[] = [];

    for (let midi = this._lowMidi; midi <= this._highMidi; midi++) {
      const enharmonics = this.findInScale(midi, scale.notes);
      if (enharmonics) {
        const diatonic = midiToDiatonic(midi, enharmonics);
        const staffPosition = diatonic - REFERENCE_DIATONIC;
        const letter = enharmonics.charAt(0);
        const accidental = enharmonics.replace(/[A-G]/, "").replace(/\d+$/, "")
          .replace(/b/g, "\u266D").replace(/#/g, "\u266F"); // ♭ ♯
        const base = FIXED_SOLFEGE[letter] ?? enharmonics;
        const solfege = base + accidental;
        scaleNotes.push({
          midi,
          name: enharmonics,
          solfege,
          accidental,
          staffPosition,
        });
      }
    }

    this._notes = scaleNotes;
  }

  private findInScale(midi: number, scaleNotes: string[]): string | null {
    for (const sn of scaleNotes) {
      // Compute the octave directly from MIDI instead of looping 0-9.
      // Note.midi("C0") = 12, so: midi = baseMidi + octave * 12
      // where baseMidi is the pitch class MIDI in octave 0.
      const baseMidi = Note.midi(sn + "0");
      if (baseMidi == null) continue;
      const octave = Math.round((midi - baseMidi) / 12);
      if (octave < 0 || octave > 9) continue;
      const full = sn + octave;
      if (Note.midi(full) === midi) return full;
    }
    return null;
  }

  noteForMidi(midi: number): ScaleNote | undefined {
    return this._notes.find((n) => n.midi === midi);
  }

  /**
   * Pick a uniformly random note from the current scale range.
   * Throws if the scale has no notes (misconfiguration guard).
   */
  randomNote(): ScaleNote {
    if (this._notes.length === 0) {
      throw new Error("randomNote() called with empty scale — set a valid key/range first");
    }
    return this._notes[Math.floor(Math.random() * this._notes.length)];
  }

  private _visitCounts: number[] = [];

  resetVisitCounts(): void {
    this._visitCounts = new Array(this._notes.length).fill(0);
  }

  /** Pick a note within ±2 scale steps of lastIndex, weighted toward less-visited notes */
  smartRandomNote(lastIndex?: number): { note: ScaleNote; index: number } {
    if (this._visitCounts.length !== this._notes.length) {
      this.resetVisitCounts();
    }

    // Candidate pool: ±2 index positions from lastIndex
    let lo = 0;
    let hi = this._notes.length - 1;
    if (lastIndex !== undefined) {
      lo = Math.max(0, lastIndex - 2);
      hi = Math.min(this._notes.length - 1, lastIndex + 2);
    }

    // Weighted random: bias toward less-visited notes
    let totalWeight = 0;
    const weights: number[] = [];
    for (let i = lo; i <= hi; i++) {
      const w = 1 / (this._visitCounts[i] + 1);
      weights.push(w);
      totalWeight += w;
    }

    let r = Math.random() * totalWeight;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r <= 0) {
        const idx = lo + i;
        this._visitCounts[idx]++;
        return { note: this._notes[idx], index: idx };
      }
    }

    // Fallback
    const idx = hi;
    this._visitCounts[idx]++;
    return { note: this._notes[idx], index: idx };
  }

  staffPositionForMidi(midi: number): number | null {
    const note = this.noteForMidi(midi);
    return note ? note.staffPosition : null;
  }

  /** MIDI number of the tonic in the lowest octave of the current range */
  tonicMidi(): number | null {
    const m = Note.midi(this._tonic + "4");
    if (m == null) return null;
    // Find the tonic closest to _lowMidi (at or above it)
    let midi = m;
    while (midi < this._lowMidi) midi += 12;
    while (midi - 12 >= this._lowMidi) midi -= 12;
    return midi;
  }
}
