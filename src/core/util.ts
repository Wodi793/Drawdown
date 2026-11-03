export const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));

/** Round to the nearest 5 g. */
export const r5 = (x: number) => Math.round(x / 5) * 5;

/** Round to the nearest 0.5 g. */
export const half = (x: number) => Math.round(x * 2) / 2;

/** 125 → "2:05" */
export function fmt(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export const uid = (prefix: string) =>
  `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
