import { GRIND_MAX, GRIND_MIN, METHODS, type MethodId } from "./rules";
import { clamp } from "./util";

/** Index → Ode label. 11 → "4.2", 12 → "5.0". */
export const grindLabel = (i: number) => `${Math.floor(i / 3) + 1}.${i % 3}`;

/** Ode label → index. Accepts "5", "5.0", "5.2"; null if unreadable. */
export function parseGrind(s: unknown): number | null {
  const m = String(s ?? "").match(/(\d+)(?:\.(\d))?/);
  if (!m) return null;
  const major = +m[1];
  const minor = m[2] ? clamp(+m[2], 0, 2) : 0;
  if (major < 1 || major > 11) return null;
  return clamp((major - 1) * 3 + minor, GRIND_MIN, GRIND_MAX);
}

/**
 * Suggested grind for a method and water amount.
 * Classic and Mellow: 4.2 at 350 g, one step coarser per 100 g more water.
 * Bright: that plus three steps.
 */
export const baseGrind = (m: MethodId, water: number) =>
  clamp(11 + Math.round((water - 350) / 100) + METHODS[m].grindAdj, GRIND_MIN, GRIND_MAX);
