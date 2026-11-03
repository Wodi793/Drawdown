export type AgeClass = "rest" | "open" | "peak" | "fade";

/** Whole days since a YYYY-MM-DD roast date, or null. */
export function daysOff(roastDate: string | undefined, now = Date.now()): number | null {
  if (!roastDate) return null;
  const t = new Date(`${roastDate}T12:00:00`).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((now - t) / 864e5);
}

/** Under 7 Resting, 7–13 Opening, 14–35 Peak, over 35 Fading. */
export function ageBadge(days: number | null): { cls: AgeClass; text: string } | null {
  if (days == null) return null;
  if (days < 7) return { cls: "rest", text: `Day ${days} · Resting` };
  if (days < 14) return { cls: "open", text: `Day ${days} · Opening` };
  if (days <= 35) return { cls: "peak", text: `Day ${days} · Peak` };
  return { cls: "fade", text: `Day ${days} · Fading` };
}
