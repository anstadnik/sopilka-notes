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

export interface LeaderboardEntry {
  name: string;
  score: number;
  mode: string;
  key: string;
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

export function getPlayerName(): string {
  return localStorage.getItem(NAME_KEY) || "";
}

export function setPlayerName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export async function getLeaderboard(key: string): Promise<LeaderboardEntry[]> {
  if (!db) return [];
  try {
    const q = query(
      collection(db, "leaderboard"),
      where("key", "==", key),
      orderBy("score", "desc"),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as LeaderboardEntry);
  } catch (e) {
    console.warn("Failed to fetch leaderboard:", e);
    return [];
  }
}

export async function addScore(name: string, score: number, mode: string, key: string): Promise<void> {
  if (!db) return;
  try {
    await addDoc(collection(db, "leaderboard"), {
      name,
      score,
      mode,
      key,
      date: new Date().toISOString().slice(0, 10),
    });
  } catch (e) {
    console.warn("Failed to save score:", e);
  }
}
