/**
 * Sopilka soprano fingering chart.
 *
 * Each entry maps a MIDI number to an array of 10 hole states:
 *   1 = closed (filled), 0 = open, 0.5 = half-hole
 *
 * Layout: [back1, back2, front1, front2, front3, front4, front5, front6, front7, front8]
 *   back1–back2: 2 thumb holes on the back (top to bottom)
 *   front1–front8: 8 finger holes on the front (top to bottom)
 */

const FINGERINGS: ReadonlyMap<number, readonly number[]> = new Map([
  // Octave 1: C5–B5 (both back holes closed)
  [72, [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]],     // C5  — ДО
  [73, [1, 1, 1, 1, 1, 1, 1, 1, 1, 0.5]],   // C#5 — ДО#/РЕb
  [74, [1, 1, 1, 1, 1, 1, 1, 1, 0, 0]],     // D5  — РЕ
  [75, [1, 1, 1, 1, 1, 1, 1, 0, 1, 0.5]],   // D#5 — РЕ#/МІb
  [76, [1, 1, 1, 1, 1, 1, 1, 0, 0, 0]],     // E5  — МІ
  [77, [1, 1, 1, 1, 1, 1, 0, 0, 0, 0]],     // F5  — ФА
  [78, [1, 1, 1, 1, 1, 0, 1, 0, 0, 0]],     // F#5 — ФА#/СОЛЬb
  [79, [1, 1, 1, 1, 1, 0, 0, 0, 0, 0]],     // G5  — СОЛЬ
  [80, [1, 1, 1, 1, 0, 1, 0, 0, 0, 0]],     // G#5 — СОЛЬ#/ЛЯb
  [81, [1, 1, 1, 1, 0, 0, 0, 0, 0, 0]],     // A5  — ЛЯ
  [82, [1, 1, 1, 0, 1, 0, 0, 0, 0, 0]],     // A#5 — ЛЯ#/СІb
  [83, [1, 1, 1, 0, 0, 0, 0, 0, 0, 0]],     // B5  — СІ

  // Octave 2: C6–C7 (top back hole open)
  [84, [0, 1, 1, 0, 0, 0, 0, 0, 0, 0]],     // C6  — ДО
  [85, [0, 1, 1, 1, 1, 1, 1, 1, 1, 0.5]],   // C#6 — ДО#/РЕb
  [86, [0, 1, 1, 1, 1, 1, 1, 1, 0, 0]],     // D6  — РЕ
  [87, [0, 1, 1, 1, 1, 1, 1, 0, 1, 0.5]],   // D#6 — РЕ#/МІb
  [88, [0, 1, 1, 1, 1, 1, 1, 0, 0, 0]],     // E6  — МІ
  [89, [0, 1, 1, 1, 1, 1, 0, 0, 0, 0]],     // F6  — ФА
  [90, [0, 1, 1, 1, 1, 0, 1, 0, 0, 0]],     // F#6 — ФА#/СОЛЬb
  [91, [0, 1, 1, 1, 1, 0, 0, 0, 0, 0]],     // G6  — СОЛЬ
  [92, [0, 1, 1, 1, 0, 1, 0, 0, 0, 0]],     // G#6 — СОЛЬ#/ЛЯb
  [93, [0, 1, 1, 1, 0, 0, 0, 0, 0, 0]],     // A6  — ЛЯ
  [94, [0, 1, 1, 0, 1, 0, 0, 0, 0, 0]],     // A#6 — ЛЯ#/СІb
  [95, [0, 1, 1, 0, 0, 0, 0, 0, 0, 0]],     // B6  — СІ
  [96, [0, 0, 1, 0, 0, 0, 0, 0, 0, 0]],     // C7  — ДО
]);

export function getFingering(midi: number): readonly number[] | null {
  return FINGERINGS.get(midi) ?? null;
}
