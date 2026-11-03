import { baseGrind } from "./grind";
import {
  DOSE_MAX, DOSE_MIN, GRIND_MAX, GRIND_MIN, METHODS, RATIO_MAX, RATIO_MIN,
  SPLIT_MAX, SPLIT_MIN, TEMP_MAX, TEMP_MIN, WATER_MAX, WATER_MIN, type MethodId,
} from "./rules";
import { clamp, half } from "./util";

/**
 * A method's settings, stored *relative* to the defaults where it matters,
 * so turning the water dial rescales them: dose follows the ratio, and grind
 * is an offset from the suggested setting for that water amount.
 */
export interface MethodSettings {
  grindOff: number;
  temp: number;
  ratio: number;
  split: number | null;
}

/** What a bag (or the default) remembers: the chosen method and water, plus settings per method. */
export interface RecipeState {
  method: MethodId;
  water: number;
  perMethod: Partial<Record<MethodId, MethodSettings>>;
}

/** Everything resolved to concrete numbers for one brew. */
export interface Resolved {
  method: MethodId;
  water: number;
  dose: number;
  grind: number;
  grindOff: number;
  temp: number;
  ratio: number;
  split: number | null;
}

export function defaultSettings(m: MethodId): MethodSettings {
  const d = METHODS[m];
  return { grindOff: 0, temp: d.temp, ratio: d.ratio, split: d.split };
}

export const defaultRecipe = (): RecipeState => ({ method: "classic", water: 450, perMethod: {} });

export const settingsFor = (r: RecipeState, m: MethodId = r.method): MethodSettings =>
  r.perMethod[m] ?? defaultSettings(m);

export function resolveSettings(m: MethodId, water: number, p: MethodSettings): Resolved {
  return {
    method: m,
    water,
    dose: half(water / p.ratio),
    grind: clamp(baseGrind(m, water) + p.grindOff, GRIND_MIN, GRIND_MAX),
    grindOff: p.grindOff,
    temp: p.temp,
    ratio: p.ratio,
    split: p.split,
  };
}

export const resolve = (r: RecipeState): Resolved => resolveSettings(r.method, r.water, settingsFor(r));

/** Target drawdown window in seconds, [earliest, latest]. */
export function windowFor(R: Pick<Resolved, "method" | "water">): [number, number] {
  if (R.method === "bright") return [195, 225];
  const lo = Math.round(150 + (R.water - 200) * 0.15) + (R.method === "mellow" ? 15 : 0);
  return [lo, lo + 30];
}

// ---- edits (all return a new RecipeState) ----

function withSettings(r: RecipeState, patch: (p: MethodSettings) => MethodSettings): RecipeState {
  return { ...r, perMethod: { ...r.perMethod, [r.method]: patch({ ...settingsFor(r) }) } };
}

export const setMethod = (r: RecipeState, m: MethodId): RecipeState => ({ ...r, method: m });

export const setWater = (r: RecipeState, w: number): RecipeState =>
  ({ ...r, water: clamp(w, WATER_MIN, WATER_MAX) });

/** Nudge the dose by ±0.5 g. This changes the ratio, which then follows the water dial. */
export const nudgeDose = (r: RecipeState, delta: number): RecipeState => {
  const R = resolve(r);
  const nd = clamp(R.dose + delta, DOSE_MIN, DOSE_MAX);
  return withSettings(r, (p) => ({ ...p, ratio: clamp(+(r.water / nd).toFixed(3), RATIO_MIN, RATIO_MAX) }));
};

export const nudgeGrind = (r: RecipeState, delta: number): RecipeState => {
  const R = resolve(r);
  return withSettings(r, (p) => ({
    ...p, grindOff: clamp(R.grind + delta, GRIND_MIN, GRIND_MAX) - baseGrind(r.method, r.water),
  }));
};

export const nudgeTemp = (r: RecipeState, delta: number): RecipeState =>
  withSettings(r, (p) => ({ ...p, temp: clamp(p.temp + delta, TEMP_MIN, TEMP_MAX) }));

export const nudgeSplit = (r: RecipeState, delta: number): RecipeState =>
  withSettings(r, (p) => ({ ...p, split: clamp(+((p.split ?? 0.5) + delta).toFixed(2), SPLIT_MIN, SPLIT_MAX) }));

/** Replace one method's settings outright (used when accepting a suggestion option). */
export const putSettings = (r: RecipeState, m: MethodId, p: MethodSettings): RecipeState =>
  ({ ...r, method: m, perMethod: { ...r.perMethod, [m]: p } });
