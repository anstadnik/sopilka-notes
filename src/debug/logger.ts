const lines: string[] = [];
let t0 = 0;

export function logInit(): void {
  t0 = performance.now();
  lines.length = 0;
  log("SESSION_START", {});
}

export function log(event: string, data: Record<string, unknown>): void {
  const ts = ((performance.now() - t0) / 1000).toFixed(3);
  lines.push(`${ts}\t${event}\t${JSON.stringify(data)}`);
}

export function downloadLog(): void {
  const blob = new Blob([lines.join("\n")], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `sopilka-log-${new Date().toISOString().slice(0, 19)}.tsv`;
  a.click();
  URL.revokeObjectURL(url);
}
