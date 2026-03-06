import type { Complexity, Tolerance } from "./game/RhythmEngine.ts";

// localStorage keys for menu state persistence
export const LS_TONIC = "sopilka-tonic";
export const LS_MODE = "sopilka-mode";
export const LS_GAME_MODE = "sopilka-game-mode";
export const LS_FULL_RANGE = "sopilka-full-range";
export const LS_CALIBRATE = "sopilka-calibrate";
export const LS_COMPETE = "sopilka-compete";
export const LS_SESSION_LENGTH = "sopilka-session-length";
export const LS_RHYTHM_BPM = "sopilka-rhythm-bpm";
export const LS_RHYTHM_COMPLEXITY = "sopilka-rhythm-complexity";
export const LS_RHYTHM_TOLERANCE = "sopilka-rhythm-tolerance";

export function getSavedTonic(): string { return localStorage.getItem(LS_TONIC) || "C"; }
export function getSavedMode(): string { return localStorage.getItem(LS_MODE) || "major"; }
export function getSavedGameMode(): string { return localStorage.getItem(LS_GAME_MODE) || "battle"; }
export function getSavedFullRange(): boolean { const v = localStorage.getItem(LS_FULL_RANGE); return v === null ? false : v === "true"; }
export function getSavedCalibrate(): boolean { return localStorage.getItem(LS_CALIBRATE) === "true"; }
export function getSavedSessionLength(): number { return parseInt(localStorage.getItem(LS_SESSION_LENGTH) || "0", 10); }
export function isCompeteMode(): boolean { return localStorage.getItem(LS_COMPETE) === "true"; }
export function setCompeteMode(on: boolean): void { localStorage.setItem(LS_COMPETE, on ? "true" : "false"); }
export function getSavedRhythmBpm(): number { return parseInt(localStorage.getItem(LS_RHYTHM_BPM) || "80", 10); }
export function getSavedRhythmComplexity(): Complexity { return (localStorage.getItem(LS_RHYTHM_COMPLEXITY) as Complexity) || "easy"; }
export function getSavedRhythmTolerance(): Tolerance { return (localStorage.getItem(LS_RHYTHM_TOLERANCE) as Tolerance) || "normal"; }

// Sopilka physical range starts at C5
export const SOPILKA_LOW = 72; // C5
