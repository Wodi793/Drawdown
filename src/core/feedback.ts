import { grindLabel } from "./grind";
import { windowFor, type MethodSettings, type Resolved } from "./recipe";
import { GRIND_MAX, GRIND_MIN, RATIO_MAX, RATIO_MIN, SPLIT_MAX, SPLIT_MIN, TEMP_MAX, TEMP_MIN } from "./rules";
import { clamp, fmt, half } from "./util";

/** How the cup tasted. 0 is "right" on every scale. */
export interface Ratings {
  /** −2 very sour … +2 very bitter */
  ext: number;
  /** −2 very flat … +2 very sharp */
  acid: number;
  /** −2 watery … +2 heavy */
  str: number;
  /** 0 clean, 1 a bit muddy, 2 muddy */
  clar: number;
  /** 1 not for me, 2 fine, 3 good, 4 great */
  overall: number;
}

export const NEUTRAL: Ratings = { ext: 0, acid: 0, str: 0, clar: 0, overall: 3 };

export interface Scale {
  key: keyof Ratings;
  name: string;
  ends: [string, string] | null;
  options: { label: string; value: number }[];
}

const opts = (labels: string[], values: number[]) => labels.map((label, i) => ({ label, value: values[i] }));
const five = [-2, -1, 0, 1, 2];

export const SCALES: Scale[] = [
  { key: "ext", name: "Extraction", ends: ["Sour", "Bitter"], options: opts(["Very sour", "Sour", "Balanced", "Bitter", "Very bitter"], five) },
  { key: "acid", name: "Acidity", ends: ["Flat", "Sharp"], options: opts(["Very flat", "Flat", "Just right", "Sharp", "Very sharp"], five) },
  { key: "str", name: "Strength", ends: ["Weak", "Heavy"], options: opts(["Watery", "Weak", "Right", "Strong", "Heavy"], five) },
  { key: "clar", name: "Clarity", ends: ["Clean", "Muddy"], options: opts(["Clean", "A bit muddy", "Muddy"], [0, 1, 2]) },
  { key: "overall", name: "Overall", ends: null, options: opts(["Not for me", "Fine", "Good", "Great"], [1, 2, 3, 4]) },
];

export const RATING_LABEL = ["", "Not for me", "Fine", "Good", "Great"];

export type Speed = "fast" | "ok" | "slow";

export function speedOf(R: Pick<Resolved, "method" | "water">, drawdown: number): Speed {
  const [lo, hi] = windowFor(R);
  return drawdown < lo ? "fast" : drawdown > hi ? "slow" : "ok";
}

export type Field = "grindOff" | "temp" | "ratio" | "split";

export interface Suggestion {
  field: Field;
  delta: number;
  title: string;
  why: string;
}

/**
 * One change for next time, checked in a fixed order:
 * sour → bitter → flat → sharp → strength → muddy → keep.
 * Returns null for "keep this recipe".
 */
export function suggest(fb: Ratings, B: Resolved & { drawdown: number }): Suggestion | null {
  const speed = speedOf(B, B.drawdown), t = fmt(B.drawdown);
  const finer = grindLabel(clamp(B.grind - 1, GRIND_MIN, GRIND_MAX));
  const coarser = grindLabel(clamp(B.grind + 1, GRIND_MIN, GRIND_MAX));
  const grind = (delta: number, title: string, why: string): Suggestion => ({ field: "grindOff", delta, title, why });
  const hotter = (by: number) => Math.min(TEMP_MAX, B.temp + by) - B.temp;
  const atBoil = B.temp >= TEMP_MAX;

  if (fb.ext < 0) {
    if (speed === "slow") {
      if (!atBoil) {
        const d = hotter(3);
        return { field: "temp", delta: d, title: `Raise water to ${B.temp + d}°F`, why: `Sour means the acids came out but not enough sugars. Normally you'd grind finer, but this already drained slowly (${t}), and a finer grind would slow it more and risk bitterness. Hotter water extracts more without changing the flow.` };
      }
      return grind(-1, `Grind one step finer, to ${finer}`, `Sour means the acids came out but not enough sugars. Your water is already at the boil for this altitude, so grind is the lever left. It drained slowly (${t}), so pour gently and low to keep the bed from clogging.`);
    }
    return grind(-1, `Grind one step finer, to ${finer}`, `Sour means the acids dissolved but the sugars that balance them didn't. A finer grind gives the water more surface and more contact time. The ${t} drain leaves room to slow down a little.`);
  }

  if (fb.ext > 0) {
    if (speed === "fast" && B.temp > TEMP_MIN) {
      const to = Math.max(TEMP_MIN, B.temp - 3);
      return { field: "temp", delta: to - B.temp, title: `Lower water to ${to}°F`, why: `Bitter even though it drained quickly (${t}) points at heat or agitation rather than contact time. Slightly cooler water pulls fewer harsh compounds. Also pour gently and low to the bed.` };
    }
    return grind(1, `Grind one step coarser, to ${coarser}`, `Bitter or drying means overextraction: the water kept going after the good flavors were out. A coarser grind drains faster and extracts less.`);
  }

  if (fb.acid < 0) {
    if (speed === "slow") return grind(1, `Grind one step coarser, to ${coarser}`, `Flat with a slow drain (${t}) usually means overextraction. Extra bitterness and body cover the fruit. Coarser gets the drawdown back in the window.`);
    if (speed === "fast") return grind(-1, `Grind one step finer, to ${finer}`, `Flat with a fast drain (${t}) usually means it's underextracted and hollow: there isn't enough sweetness for the acidity to read as fruit. Finer builds sweetness.`);
    const split = B.split ?? 0.5;
    if (B.method === "bright" && split < SPLIT_MAX) return { field: "split", delta: 0.05, title: `Make the first pour bigger (${Math.round((split + 0.05) * 100)}% of the first 40%)`, why: `In the 4:6 method the first pour extracts the most acids. Making it larger tilts the cup toward acidity and fruit without changing strength or grind.` };
    return { field: "ratio", delta: 0.5, title: `Use a weaker ratio, 1:${(B.ratio + 0.5).toFixed(1)}`, why: `The extraction looks right (${t}, not sour or bitter), so the fruit is there but buried. A slightly weaker brew makes acidity easier to taste. For a bigger shift, try the Bright method with this coffee.` };
  }

  if (fb.acid > 0) {
    const split = B.split ?? 0.5;
    if (B.method === "bright" && split > SPLIT_MIN) return { field: "split", delta: -0.05, title: `Make the first pour smaller (${Math.round((split - 0.05) * 100)}% of the first 40%)`, why: `Sharp means acidity outweighs sweetness. In the 4:6 method a smaller first pour shifts the balance toward sweetness.` };
    if (speed === "slow") {
      if (!atBoil) {
        const d = hotter(2);
        return { field: "temp", delta: d, title: `Raise water to ${B.temp + d}°F`, why: `Sharp means the acidity isn't balanced by enough sweetness, so you want a bit more extraction. The drain was already slow, so add heat rather than grinding finer.` };
      }
      return grind(-1, `Grind one step finer, to ${finer}`, `Sharp means the acidity isn't balanced by enough sweetness. Your water is already at the boil, so grind a touch finer for more extraction, and pour gently since the drain was already slow.`);
    }
    return grind(-1, `Grind one step finer, to ${finer}`, `Sharp means the acidity isn't balanced by enough sweetness. A little more extraction builds sugars and rounds the acidity.`);
  }

  if (fb.str !== 0) {
    const dl = fb.str < 0 ? -0.5 : 0.5;
    return { field: "ratio", delta: dl, title: `${fb.str < 0 ? "Dose up" : "Dose down"}: ${half(B.water / (B.ratio + dl))} g coffee (1:${(B.ratio + dl).toFixed(1)})`, why: `Strength is how much coffee is dissolved in the cup, not how well it extracted. Changing the dose fixes strength without disturbing the flavor balance, which a grind change would.` };
  }

  if (fb.clar > 0) return grind(1, `Grind one step coarser, to ${coarser}`, `Muddiness usually comes from fines and agitation. One step coarser makes fewer fines. Also pour lower and more gently, and keep the swirls light.`);

  return null;
}

/** Apply an accepted suggestion to a method's settings. */
export function applySuggestion(p: MethodSettings, s: Pick<Suggestion, "field" | "delta">): MethodSettings {
  switch (s.field) {
    case "grindOff": return { ...p, grindOff: p.grindOff + s.delta };
    case "temp": return { ...p, temp: clamp(p.temp + s.delta, TEMP_MIN, TEMP_MAX) };
    case "ratio": return { ...p, ratio: clamp(+(p.ratio + s.delta).toFixed(2), RATIO_MIN, RATIO_MAX) };
    case "split": return { ...p, split: clamp(+((p.split ?? 0.5) + s.delta).toFixed(2), SPLIT_MIN, SPLIT_MAX) };
  }
}
