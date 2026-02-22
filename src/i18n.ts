export type Lang = "uk" | "en";

const translations = {
  // Start screen
  title: { en: "Sopilkar", uk: "Сопілкар" },
  player: { en: "Player:", uk: "Гравець:" },
  playerPlaceholder: { en: "Your name", uk: "Ваше ім'я" },
  key: { en: "Key:", uk: "Тональність:" },
  mode: { en: "Mode:", uk: "Лад:" },
  major: { en: "Major", uk: "Мажор" },
  minor: { en: "Minor", uk: "Мінор" },
  fullRange: { en: "Full range (C–C–C)", uk: "Повний діапазон (до–до–до)" },
  game: { en: "Game:", uk: "Гра:" },
  sheetMusic: { en: "Sheet Music", uk: "Нотний стан" },
  monsterDefense: { en: "Monster Defense", uk: "Захист від монстрів" },
  enableCalibration: { en: "Enable calibration", uk: "Увімкнути калібрування" },
  calibrationHint: { en: "Turn on if note detection is unreliable", uk: "Увімкніть, якщо розпізнавання нот працює нестабільно" },
  startBtn: { en: "Start (enable mic)", uk: "Старт (увімкнути мікрофон)" },
  startHint: { en: "Play notes on your sopilka to hit the scrolling targets!", uk: "Грайте ноти на сопілці, щоб влучити в цілі!" },

  // Leaderboard
  leaderboard: { en: "Leaderboard", uk: "Таблиця лідерів" },
  noScores: { en: "No scores yet for", uk: "Ще немає результатів для" },
  lbName: { en: "Name", uk: "Ім'я" },
  lbScore: { en: "Score", uk: "Рахунок" },
  lbMode: { en: "Mode", uk: "Режим" },

  // Calibration
  calibration: { en: "Calibration", uk: "Калібрування" },
  calNote: { en: "Note", uk: "Нота" },
  calPlayAndHold: { en: "Play <strong id=\"cal-note\">{note}</strong> and hold...", uk: "Зіграйте <strong id=\"cal-note\">{note}</strong> і тримайте..." },
  calWaiting: { en: "Waiting to hear the note...", uk: "Очікування звуку..." },
  calListening: { en: "Listening...", uk: "Слухаю..." },
  calHoldSteady: { en: "Hold steady...", uk: "Тримайте стабільно..." },
  calHearing: { en: "Hearing:", uk: "Чую:" },

  // Game buttons
  pause: { en: "Pause", uk: "Пауза" },
  modeWait: { en: "Mode: Wait", uk: "Режим: Очікування" },
  modeScroll: { en: "Mode: Scroll", uk: "Режим: Прокрутка" },
  labelsOn: { en: "Labels: On", uk: "Підписи: Увімк" },
  labelsOff: { en: "Labels: Off", uk: "Підписи: Вимк" },
  hintsOn: { en: "Hints: On", uk: "Підказки: Увімк" },
  hintsOff: { en: "Hints: Off", uk: "Підказки: Вимк" },

  // Pause overlay
  paused: { en: "Paused", uk: "Пауза" },
  resume: { en: "Resume", uk: "Продовжити" },
  exitToMenu: { en: "Exit to Menu", uk: "Вийти в меню" },

  // HUD
  note: { en: "Note:", uk: "Нота:" },
  cents: { en: "Cents:", uk: "Центи:" },
  conf: { en: "Conf:", uk: "Точн:" },
  score: { en: "Score:", uk: "Рахунок:" },
  combo: { en: "combo", uk: "комбо" },

  // Battle
  gameOver: { en: "GAME OVER", uk: "ГРА ЗАКІНЧЕНА" },
  finalScore: { en: "Final Score:", uk: "Фінальний рахунок:" },
  goBack: { en: "Go Back", uk: "Назад" },

  // Alerts
  alertNoNotes: { en: "No notes in this key/range. Try a different key.", uk: "Немає нот у цій тональності/діапазоні. Спробуйте іншу тональність." },
  alertMic: { en: "Could not access microphone. Please allow mic access and reload.", uk: "Не вдалося отримати доступ до мікрофона. Дозвольте доступ до мікрофона та перезавантажте." },
} as const;

export type TranslationKey = keyof typeof translations;

const STORAGE_KEY = "sopilka-lang";

let currentLang: Lang = (localStorage.getItem(STORAGE_KEY) as Lang) || "uk";

export function getLang(): Lang {
  return currentLang;
}

export function setLang(lang: Lang): void {
  currentLang = lang;
  localStorage.setItem(STORAGE_KEY, lang);
}

export function t(key: TranslationKey): string {
  return translations[key][currentLang];
}
