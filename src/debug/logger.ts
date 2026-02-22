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

