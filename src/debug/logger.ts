export type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MAX_BUFFER_SIZE = 10_000;

interface LogLine {
  ts: string;
  level: LogLevel;
  event: string;
  data: string;
}

const lines: LogLine[] = [];
let t0 = 0;
let minLevel: LogLevel = "debug";

export function setLogLevel(level: LogLevel): void {
  minLevel = level;
}

export function logInit(): void {
  t0 = performance.now();
  lines.length = 0;
  log("SESSION_START", {});
}

/**
 * Append a log entry. This preserves the original two-arg signature
 * used throughout the codebase while also accepting an optional level.
 */
export function log(event: string, data: Record<string, unknown>, level: LogLevel = "info"): void {
  if (LOG_LEVEL_PRIORITY[level] < LOG_LEVEL_PRIORITY[minLevel]) return;

  const ts = ((performance.now() - t0) / 1000).toFixed(3);

  // Enforce max buffer size — drop oldest entries when full
  if (lines.length >= MAX_BUFFER_SIZE) {
    lines.splice(0, lines.length - MAX_BUFFER_SIZE + 1);
  }

  lines.push({ ts, level, event, data: JSON.stringify(data) });
}

/** Export the current session log as a downloadable text file. */
export function flush(): void {
  const text = lines
    .map((l) => `${l.ts}\t${l.level.toUpperCase()}\t${l.event}\t${l.data}`)
    .join("\n");

  const blob = new Blob([text], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sopilka-log-${new Date().toISOString().slice(0, 19).replace(/:/g, "-")}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
