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
  fullRange: { en: "Full sopilka range (2 octaves)", uk: "Повний діапазон сопілки (2 октави)" },
  game: { en: "Game:", uk: "Гра:" },
  sheetMusic: { en: "Sheet Music", uk: "Нотний стан" },
  monsterDefense: { en: "Monster Defense", uk: "Захист від монстрів" },
  enableCalibration: { en: "Enable calibration", uk: "Увімкнути калібрування" },
  calibrationHint: { en: "Turn on if note detection is unreliable", uk: "Увімкніть, якщо розпізнавання нот працює нестабільно" },
  startBtn: { en: "Start (enable mic)", uk: "Старт (увімкнути мікрофон)" },
  startHint: { en: "Play notes on your sopilka to hit the scrolling targets!", uk: "Грайте ноти на сопілці, щоб влучити в цілі!" },
  compete: { en: "Compete", uk: "Змагатися" },
  competeHint: { en: "Enter your name to save scores to the leaderboard", uk: "Введіть ім'я, щоб зберігати результати в таблицю лідерів" },

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
  cleanOn: { en: "Clean: On", uk: "Чистий: Увімк" },
  cleanOff: { en: "Clean: Off", uk: "Чистий: Вимк" },

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

  // Session
  sessionLength: { en: "Notes:", uk: "Кількість нот:" },
  endless: { en: "Endless", uk: "Без обмежень" },
  sessionComplete: { en: "Session Complete!", uk: "Сесію завершено!" },
  notesHit: { en: "Notes Hit", uk: "Влучень" },
  notesMissed: { en: "Notes Missed", uk: "Промахів" },
  accuracy: { en: "Accuracy", uk: "Точність" },
  longestCombo: { en: "Longest Combo", uk: "Найдовше комбо" },

  // UI
  advancedSettings: { en: "Advanced Settings", uk: "Додаткові налаштування" },

  // Loading
  loading: { en: "Loading...", uk: "Завантаження..." },

  // In-game hints
  escHint: { en: "Press ESC to pause", uk: "Натисніть ESC для паузи" },

  // Alerts
  alertNoNotes: { en: "No notes in this key/range. Try a different key.", uk: "Немає нот у цій тональності/діапазоні. Спробуйте іншу тональність." },
  alertMic: { en: "Could not access microphone. Please allow mic access and reload.", uk: "Не вдалося отримати доступ до мікрофона. Дозвольте доступ до мікрофона та перезавантажте." },

  // Help
  helpTitle: { en: "How to Play", uk: "Як грати" },
  helpClose: { en: "Got it!", uk: "Зрозуміло!" },
  helpIntro: {
    en: "Sopilkar is a game for learning the <strong>sopilka</strong> (Ukrainian flute). Play notes into your microphone and the app detects what you're playing in real time.",
    uk: "Сопілкар — гра для вивчення <strong>сопілки</strong>. Грайте ноти в мікрофон, і застосунок розпізнає їх у реальному часі.",
  },
  helpSettingsTitle: { en: "Menu Settings", uk: "Налаштування меню" },
  helpKeyDesc: {
    en: "<strong>Key</strong> — the tonic note of the scale (До, Ре, Мі…).",
    uk: "<strong>Тональність</strong> — тоніка гами (До, Ре, Мі…).",
  },
  helpModeDesc: {
    en: "<strong>Mode</strong> — Major (happy) or Minor (sad) scale.",
    uk: "<strong>Лад</strong> — Мажор (веселий) або Мінор (сумний).",
  },
  helpFullRangeDesc: {
    en: "<strong>Full range</strong> — play across the full sopilka range (2 octaves). Off = 1 octave from the selected key.",
    uk: "<strong>Повний діапазон</strong> — грати через повний діапазон сопілки (2 октави). Вимкнено = 1 октава від обраної тональності.",
  },
  helpCalibrationDesc: {
    en: "<strong>Calibration</strong> — play 8 notes before the game so the app tunes to your instrument and microphone. Turn on if notes aren't detected well.",
    uk: "<strong>Калібрування</strong> — зіграйте 8 нот перед грою, щоб застосунок налаштувався на ваш інструмент і мікрофон. Увімкніть, якщо ноти погано розпізнаються.",
  },
  helpCompeteDesc: {
    en: "<strong>Compete</strong> — enter your name and your scores are saved to a leaderboard.",
    uk: "<strong>Змагатися</strong> — введіть ім'я, і ваші результати зберігатимуться в таблицю лідерів.",
  },
  helpSheetTitle: { en: "Sheet Music Mode", uk: "Режим «Нотний стан»" },
  helpSheetDesc: {
    en: "Notes scroll from right to left on a musical staff. Play the correct note on your sopilka to hit each one. <strong>Wait mode</strong> pauses notes until you play them. <strong>Scroll mode</strong> keeps them moving — timing matters!",
    uk: "Ноти рухаються справа наліво по нотному стану. Зіграйте правильну ноту на сопілці, щоб влучити. <strong>Режим очікування</strong> зупиняє ноти, поки ви їх не зіграєте. <strong>Режим прокрутки</strong> — ноти рухаються без зупинки!",
  },
  helpBattleTitle: { en: "Monster Defense Mode", uk: "Режим «Захист від монстрів»" },
  helpBattleDesc: {
    en: "Monsters approach from all directions. Each one shows a note on a mini staff — play that note to defeat it. You have 3 lives. Difficulty increases as your score grows!",
    uk: "Монстри наближаються з усіх боків. Кожен показує ноту на міні-нотному стані — зіграйте цю ноту, щоб його перемогти. У вас 3 життя. Складність зростає з рахунком!",
  },
  helpInGameTitle: { en: "In-Game Buttons", uk: "Кнопки під час гри" },
  helpPauseDesc: {
    en: "<strong>Pause</strong> — pause the game (also ESC key).",
    uk: "<strong>Пауза</strong> — зупинити гру (також клавіша ESC).",
  },
  helpWaitToggleDesc: {
    en: "<strong>Mode: Wait / Scroll</strong> — switch between waiting for you and continuous scrolling (Sheet Music only).",
    uk: "<strong>Режим: Очікування / Прокрутка</strong> — перемикання між очікуванням і безперервною прокруткою (тільки «Нотний стан»).",
  },
  helpLabelsDesc: {
    en: "<strong>Labels</strong> — show or hide note names on the staff.",
    uk: "<strong>Підписи</strong> — показати або сховати назви нот.",
  },
  helpHintsDesc: {
    en: "<strong>Hints</strong> — show or hide sopilka fingering diagrams.",
    uk: "<strong>Підказки</strong> — показати або сховати аплікатуру сопілки.",
  },
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
