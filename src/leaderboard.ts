import { initializeApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  where,
  limit,
  getDocs,
} from "firebase/firestore";

const NAME_KEY = "sopilka-player-name";

/** Shape of a leaderboard document stored in Firestore. */
export interface LeaderboardEntry {
  name: string;
  score: number;
  mode: string;
  key: string;
  /** ISO date string (YYYY-MM-DD) */
  date: string;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;

const firebaseEnabled = !!firebaseConfig.projectId;
const app = firebaseEnabled ? initializeApp(firebaseConfig) : null;

if (app && recaptchaSiteKey) {
  initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(recaptchaSiteKey),
    isTokenAutoRefreshEnabled: true,
  });
}

const db = app ? getFirestore(app) : null;

// ---------------------------------------------------------------------------
// Rate limiting for addScore — at most 1 call per RATE_LIMIT_MS milliseconds
// ---------------------------------------------------------------------------
const RATE_LIMIT_MS = 5_000;
let lastAddScoreTime = 0;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isOffline(): boolean {
  return typeof navigator !== "undefined" && !navigator.onLine;
}

/** Retry an async operation once after a short delay on failure. */
async function withRetry<T>(fn: () => Promise<T>, delayMs = 1_000): Promise<T> {
  try {
    return await fn();
  } catch {
    await new Promise((r) => setTimeout(r, delayMs));
    return fn(); // let second attempt throw naturally
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function getPlayerName(): string {
  return localStorage.getItem(NAME_KEY) || "";
}

export function setPlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export async function getLeaderboard(key: string): Promise<LeaderboardEntry[]> {
  if (!db || isOffline()) return [];
  try {
    return await withRetry(async () => {
      const q = query(
        collection(db!, "leaderboard"),
        where("key", "==", key),
        orderBy("score", "desc"),
        limit(20),
      );
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as LeaderboardEntry);
    });
  } catch (e) {
    console.warn("Failed to fetch leaderboard:", e);
    return [];
  }
}

export async function addScore(name: string, score: number, mode: string, key: string): Promise<void> {
  if (!db || isOffline()) return;

  // Rate-limit: ignore calls that arrive too quickly
  const now = Date.now();
  if (now - lastAddScoreTime < RATE_LIMIT_MS) {
    console.warn("addScore rate-limited — skipping");
    return;
  }
  lastAddScoreTime = now;

  try {
    await withRetry(async () => {
      const doc: LeaderboardEntry = {
        name,
        score,
        mode,
        key,
        date: new Date().toISOString().slice(0, 10),
      };
      await addDoc(collection(db!, "leaderboard"), doc);
    });
  } catch (e) {
    console.warn("Failed to save score:", e);
  }
}
