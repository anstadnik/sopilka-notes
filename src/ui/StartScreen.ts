import { getPlayerName, getLeaderboard } from "../leaderboard.ts";
import { t, getLang, setLang, type Lang, type TranslationKey } from "../i18n.ts";
import {
  LS_TONIC, LS_MODE, LS_GAME_MODE, LS_FULL_RANGE, LS_CALIBRATE,
  LS_SESSION_LENGTH, LS_RHYTHM_BPM, LS_RHYTHM_COMPLEXITY, LS_RHYTHM_TOLERANCE,
  getSavedTonic, getSavedMode, getSavedGameMode, getSavedFullRange,
  getSavedCalibrate, getSavedSessionLength, getSavedRhythmBpm,
  getSavedRhythmComplexity, getSavedRhythmTolerance,
  isCompeteMode, setCompeteMode,
} from "../settings.ts";

export function getSelectedKey(): string {
  const tonic = (document.getElementById("tonic") as HTMLSelectElement)?.value ?? "C";
  const mode = (document.getElementById("mode") as HTMLSelectElement)?.value ?? "major";
  return `${tonic} ${mode}`;
}

export function renderLeaderboard(entries: { name: string; score: number; mode: string }[], key: string): string {
  if (entries.length === 0) return `<div id="leaderboard"><p class="hint">${t("noScores")} ${key}</p></div>`;
  const rows = entries
    .slice(0, 10)
    .map((e, i) => `<tr><td>${i + 1}</td><td>${e.name}</td><td>${e.score}</td><td>${e.mode}</td></tr>`)
    .join("");
  return `
    <div id="leaderboard">
      <h3>${t("leaderboard")} — ${key}</h3>
      <table>
        <thead><tr><th>#</th><th>${t("lbName")}</th><th>${t("lbScore")}</th><th>${t("lbMode")}</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

export function refreshLeaderboard(): void {
  const key = getSelectedKey();
  getLeaderboard(key).then((entries) => {
    const el = document.getElementById("leaderboard");
    if (el) el.outerHTML = renderLeaderboard(entries, key);
  });
}

export function buildUI(): void {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  const savedName = getPlayerName();
  const savedTonic = getSavedTonic();
  const savedMode = getSavedMode();
  const savedGameMode = getSavedGameMode();
  const competing = isCompeteMode();
  const otherLang: Lang = getLang() === "uk" ? "en" : "uk";
  const langLabel = otherLang === "en" ? "\u{1F1EC}\u{1F1E7}" : "\u{1F1FA}\u{1F1E6}";
  const TONICS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const TONIC_LABELS: Record<string, string> = {
    "C": "\u0414\u043E", "Db": "\u0420\u0435\u266D", "D": "\u0420\u0435", "Eb": "\u041C\u0456\u266D", "E": "\u041C\u0456", "F": "\u0424\u0430",
    "Gb": "\u0421\u043E\u043B\u044C\u266D", "G": "\u0421\u043E\u043B\u044C", "Ab": "\u041B\u044F\u266D", "A": "\u041B\u044F", "Bb": "\u0421\u0456\u266D", "B": "\u0421\u0456",
  };
  const tonicOptions = TONICS.map(n => `<option value="${n}"${n === savedTonic ? " selected" : ""}>${TONIC_LABELS[n]}</option>`).join("");
  const savedKey = `${savedTonic} ${savedMode}`;
  app.innerHTML = `
    <div id="start-screen">
      <div class="title-row">
        <h1 data-i18n="title">${t("title")}</h1>
        <button id="help-btn" class="title-icon-btn" aria-label="Help">?</button>
        <button id="lang-btn" class="title-icon-btn">${langLabel}</button>
      </div>
      <div class="settings-primary">
        <label>
          ${t("key")}
          <select id="tonic">
            ${tonicOptions}
          </select>
        </label>
        <label>
          ${t("mode")}
          <select id="mode">
            <option value="major"${savedMode === "major" ? " selected" : ""}>${t("major")}</option>
            <option value="minor"${savedMode === "minor" ? " selected" : ""}>${t("minor")}</option>
          </select>
        </label>
        <label>
          ${t("game")}
          <select id="game-mode">
            <option value="battle"${savedGameMode === "battle" ? " selected" : ""}>${t("monsterDefense")}</option>
            <option value="sheet"${savedGameMode === "sheet" ? " selected" : ""}>${t("sheetMusic")}</option>
            <option value="rhythm"${savedGameMode === "rhythm" ? " selected" : ""}>${t("rhythm")}</option>
          </select>
        </label>
      </div>
      <details class="settings-advanced"${competing ? " open" : ""}>
        <summary data-i18n="advancedSettings">${t("advancedSettings")}</summary>
        <div class="settings-advanced-content">
          <label id="all-notes-label">
            <input id="all-notes-check" type="checkbox" ${getSavedFullRange() ? "checked" : ""} />
            ${t("fullRange")}
          </label>
          <div id="session-length-row" style="display: ${savedGameMode === "sheet" || savedGameMode === "rhythm" ? "" : "none"}">
            <label>
              ${t("sessionLength")}
              <select id="session-length">
                <option value="0"${getSavedSessionLength() === 0 ? " selected" : ""}>${t("endless")}</option>
                <option value="20"${getSavedSessionLength() === 20 ? " selected" : ""}>20</option>
                <option value="50"${getSavedSessionLength() === 50 ? " selected" : ""}>50</option>
                <option value="100"${getSavedSessionLength() === 100 ? " selected" : ""}>100</option>
              </select>
            </label>
          </div>
          <div id="rhythm-settings" style="display: ${savedGameMode === "rhythm" ? "" : "none"}">
            <label>
              ${t("bpm")}
              <select id="rhythm-bpm">
                <option value="60"${getSavedRhythmBpm() === 60 ? " selected" : ""}>60</option>
                <option value="80"${getSavedRhythmBpm() === 80 ? " selected" : ""}>80</option>
                <option value="100"${getSavedRhythmBpm() === 100 ? " selected" : ""}>100</option>
                <option value="120"${getSavedRhythmBpm() === 120 ? " selected" : ""}>120</option>
              </select>
            </label>
            <label>
              ${t("complexity")}
              <select id="rhythm-complexity">
                <option value="easy"${getSavedRhythmComplexity() === "easy" ? " selected" : ""}>${t("complexityEasy")}</option>
                <option value="medium"${getSavedRhythmComplexity() === "medium" ? " selected" : ""}>${t("complexityMedium")}</option>
                <option value="hard"${getSavedRhythmComplexity() === "hard" ? " selected" : ""}>${t("complexityHard")}</option>
              </select>
            </label>
            <label>
              ${t("tolerance")}
              <select id="rhythm-tolerance">
                <option value="loose"${getSavedRhythmTolerance() === "loose" ? " selected" : ""}>${t("toleranceLoose")}</option>
                <option value="normal"${getSavedRhythmTolerance() === "normal" ? " selected" : ""}>${t("toleranceNormal")}</option>
                <option value="tight"${getSavedRhythmTolerance() === "tight" ? " selected" : ""}>${t("toleranceTight")}</option>
              </select>
            </label>
          </div>
          <label>
            <input id="calibrate-check" type="checkbox" ${getSavedCalibrate() ? "checked" : ""} />
            ${t("enableCalibration")}
          </label>
          <p class="hint">${t("calibrationHint")}</p>
          <button id="compete-btn" class="compete-btn">${t("compete")}${competing ? " \u2713" : ""}</button>
          <div id="compete-section" style="display: ${competing ? "contents" : "none"}">
            <label>
              ${t("player")}
              <input id="player-name" type="text" placeholder="${t("playerPlaceholder")}" maxlength="20" value="${savedName}" />
            </label>
            <p class="hint">${t("competeHint")}</p>
            ${renderLeaderboard([], savedKey)}
          </div>
        </div>
      </details>
      <button id="start-btn" data-i18n="startBtn">${t("startBtn")}</button>
      <p class="hint" data-i18n="startHint">${t("startHint")}</p>
    </div>
    <div id="help-overlay">
      <div class="help-modal">
        <h2>${t("helpTitle")}</h2>
        <div class="help-body">
          <p>${t("helpIntro")}</p>
          <h3>${t("helpSettingsTitle")}</h3>
          <ul>
            <li>${t("helpKeyDesc")}</li>
            <li>${t("helpModeDesc")}</li>
            <li>${t("helpFullRangeDesc")}</li>
            <li>${t("helpCalibrationDesc")}</li>
            <li>${t("helpCompeteDesc")}</li>
          </ul>
          <h3>${t("helpSheetTitle")}</h3>
          <p>${t("helpSheetDesc")}</p>
          <h3>${t("helpBattleTitle")}</h3>
          <p>${t("helpBattleDesc")}</p>
          <h3>${t("helpRhythmTitle")}</h3>
          <p>${t("helpRhythmDesc")}</p>
          <h3>${t("helpInGameTitle")}</h3>
          <ul>
            <li>${t("helpPauseDesc")}</li>
            <li>${t("helpWaitToggleDesc")}</li>
            <li>${t("helpLabelsDesc")}</li>
            <li>${t("helpHintsDesc")}</li>
          </ul>
        </div>
        <button id="help-close-btn">${t("helpClose")}</button>
      </div>
    </div>
    <div id="loading-screen">
      <div class="loading-spinner"></div>
      <p>${t("loading")}</p>
    </div>
    <div id="calibration-screen">
      <h2>${t("calibration")}</h2>
      <p id="cal-step">${t("calNote")} 1 / 8</p>
      <p id="cal-instruction">${t("calPlayAndHold").replace("{note}", "do")}</p>
      <p id="cal-status" class="hint">${t("calWaiting")}</p>
      <div class="progress-bar"><div id="cal-progress" class="progress-fill"></div></div>
      <p id="cal-detected">${t("calListening")}</p>
    </div>
    <div id="game-container">
      <div class="game-btn-bar">
        <button id="pause-btn" class="game-btn">${t("pause")}</button>
        <div class="game-btn-right">
          <button id="wait-toggle" class="game-btn">${t("modeWait")}</button>
          <button id="clean-toggle" class="game-btn" style="display:none">${t("cleanOff")}</button>
          <button id="strict-toggle" class="game-btn" style="display:none">${t("strictOff")}</button>
          <button id="labels-toggle" class="game-btn">${t("labelsOn")}</button>
          <button id="hints-toggle" class="game-btn">${t("hintsOn")}</button>
        </div>
      </div>
      <div id="pause-overlay">
        <h2>${t("paused")}</h2>
        <button id="resume-btn" class="pause-menu-btn">${t("resume")}</button>
        <button id="exit-btn" class="pause-menu-btn exit">${t("exitToMenu")}</button>
      </div>
      <div id="esc-hint" class="esc-hint">${t("escHint")}</div>
      <div id="results-overlay">
        <h2>${t("sessionComplete")}</h2>
        <div class="results-stats">
          <p id="results-hit"></p>
          <p id="results-missed"></p>
          <p id="results-accuracy"></p>
          <p id="results-combo"></p>
          <p id="results-score"></p>
        </div>
        <button id="results-exit-btn" class="pause-menu-btn">${t("exitToMenu")}</button>
      </div>
    </div>
  `;

  // Load leaderboard asynchronously (only when competing)
  if (competing) refreshLeaderboard();
}

export function updateAllTranslations(): void {
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n") as TranslationKey;
    el.textContent = t(key);
  });

  // Language button
  const otherLang: Lang = getLang() === "uk" ? "en" : "uk";
  const langLabel = otherLang === "en" ? "\u{1F1EC}\u{1F1E7}" : "\u{1F1FA}\u{1F1E6}";
  document.getElementById("lang-btn")!.textContent = langLabel;

  // Compete button (has checkmark)
  const competeBtn = document.getElementById("compete-btn");
  if (competeBtn) {
    competeBtn.textContent = t("compete") + (isCompeteMode() ? " \u2713" : "");
  }

  // Select option texts
  const modeEl = document.getElementById("mode") as HTMLSelectElement | null;
  if (modeEl) {
    modeEl.options[0].textContent = t("major");
    modeEl.options[1].textContent = t("minor");
  }
  const gameModeEl = document.getElementById("game-mode") as HTMLSelectElement | null;
  if (gameModeEl) {
    gameModeEl.options[0].textContent = t("monsterDefense");
    gameModeEl.options[1].textContent = t("sheetMusic");
    gameModeEl.options[2].textContent = t("rhythm");
  }
  const sessionLengthEl = document.getElementById("session-length") as HTMLSelectElement | null;
  if (sessionLengthEl) {
    sessionLengthEl.options[0].textContent = t("endless");
  }
}

export function attachListeners(onStartGame: () => void): void {
  const tonicEl = document.getElementById("tonic") as HTMLSelectElement;
  const modeEl = document.getElementById("mode") as HTMLSelectElement;
  const gameModeEl = document.getElementById("game-mode") as HTMLSelectElement;
  const fullRangeEl = document.getElementById("all-notes-check") as HTMLInputElement;
  const calibrateEl = document.getElementById("calibrate-check") as HTMLInputElement;

  tonicEl.addEventListener("change", () => {
    localStorage.setItem(LS_TONIC, tonicEl.value);
    if (isCompeteMode()) refreshLeaderboard();
  });
  modeEl.addEventListener("change", () => {
    localStorage.setItem(LS_MODE, modeEl.value);
    if (isCompeteMode()) refreshLeaderboard();
  });
  gameModeEl.addEventListener("change", () => {
    localStorage.setItem(LS_GAME_MODE, gameModeEl.value);
    const isSheetOrRhythm = gameModeEl.value === "sheet" || gameModeEl.value === "rhythm";
    document.getElementById("session-length-row")!.style.display = isSheetOrRhythm ? "" : "none";
    document.getElementById("rhythm-settings")!.style.display = gameModeEl.value === "rhythm" ? "" : "none";
  });
  const sessionLengthEl = document.getElementById("session-length") as HTMLSelectElement;
  sessionLengthEl.addEventListener("change", () => { localStorage.setItem(LS_SESSION_LENGTH, sessionLengthEl.value); });
  fullRangeEl.addEventListener("change", () => { localStorage.setItem(LS_FULL_RANGE, String(fullRangeEl.checked)); });
  calibrateEl.addEventListener("change", () => { localStorage.setItem(LS_CALIBRATE, String(calibrateEl.checked)); });
  const rhythmBpmEl = document.getElementById("rhythm-bpm") as HTMLSelectElement;
  rhythmBpmEl.addEventListener("change", () => { localStorage.setItem(LS_RHYTHM_BPM, rhythmBpmEl.value); });
  const rhythmComplexityEl = document.getElementById("rhythm-complexity") as HTMLSelectElement;
  rhythmComplexityEl.addEventListener("change", () => { localStorage.setItem(LS_RHYTHM_COMPLEXITY, rhythmComplexityEl.value); });
  const rhythmToleranceEl = document.getElementById("rhythm-tolerance") as HTMLSelectElement;
  rhythmToleranceEl.addEventListener("change", () => { localStorage.setItem(LS_RHYTHM_TOLERANCE, rhythmToleranceEl.value); });

  document.getElementById("compete-btn")!.addEventListener("click", () => {
    const nowCompeting = !isCompeteMode();
    setCompeteMode(nowCompeting);
    const section = document.getElementById("compete-section")!;
    const btn = document.getElementById("compete-btn")!;
    if (nowCompeting) {
      section.style.display = "contents";
      btn.textContent = t("compete") + " \u2713";
      refreshLeaderboard();
    } else {
      section.style.display = "none";
      btn.textContent = t("compete");
    }
  });

  document.getElementById("start-btn")!.addEventListener("click", onStartGame);

  const helpOverlay = document.getElementById("help-overlay")!;
  document.getElementById("help-btn")!.addEventListener("click", () => {
    helpOverlay.style.display = "flex";
  });
  document.getElementById("help-close-btn")!.addEventListener("click", () => {
    helpOverlay.style.display = "none";
  });
  helpOverlay.addEventListener("click", (e) => {
    if (e.target === helpOverlay) helpOverlay.style.display = "none";
  });

  document.getElementById("lang-btn")!.addEventListener("click", () => {
    const newLang: Lang = getLang() === "uk" ? "en" : "uk";
    setLang(newLang);
    updateAllTranslations();
  });
}
