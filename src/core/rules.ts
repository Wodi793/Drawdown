// Every hard number the app depends on, in one place.
// Equipment: Hario V60 02, Fellow Ode Gen 2 (stock burrs), Third Wave Water classic.

export type MethodId = "classic" | "mellow" | "bright";

export interface MethodDef {
  id: MethodId;
  name: string;
  /** Water : coffee, e.g. 16.7 means 1:16.7 */
  ratio: number;
  /** Default water temperature, °F */
  temp: number;
  /** Grind steps coarser than the Classic baseline */
  grindAdj: number;
  /** Bright only: first pour's share of the first 40% of water */
  split: number | null;
  /** One line under the method button: what it is, what it does to the cup */
  line: string;
}

export const METHODS: Record<MethodId, MethodDef> = {
  classic: {
    id: "classic", name: "Classic", ratio: 16.7, temp: 210, grindAdj: 0, split: null,
    line: "Hoffmann one-cup. Bloom, four even pours. Balanced and clean.",
  },
  mellow: {
    id: "mellow", name: "Mellow", ratio: 16.7, temp: 210, grindAdj: 0, split: null,
    line: "Hoffmann Ultimate. Two big pours and a stir. Sweeter, more body.",
  },
  bright: {
    id: "bright", name: "Bright", ratio: 15, temp: 205, grindAdj: 3, split: 0.5,
    line: "Kasuya 4:6. Coarser, five timed pours. Clearer, livelier fruit.",
  },
};

export const METHOD_IDS: MethodId[] = ["classic", "mellow", "bright"];

export const WATER_MIN = 200;
export const WATER_MAX = 500;
export const WATER_STEP = 25;

/**
 * Water boils at about 210.5°F in Ann Arbor (~840 ft), so anything above 210
 * is a number the kettle can't actually deliver. Suggestions never go past it.
 */
export const TEMP_MAX = 210;
export const TEMP_MIN = 190;

export const RATIO_MIN = 13;
export const RATIO_MAX = 19;
export const DOSE_MIN = 8;
export const DOSE_MAX = 40;
export const SPLIT_MIN = 0.35;
export const SPLIT_MAX = 0.65;

/** A V60 02 holds about this much coffee comfortably. */
export const V60_02_CAPACITY_G = 30;

/** Ode Gen 2: 1.0 … 11.0 in thirds → index 0 … 30. */
export const GRIND_MIN = 0;
export const GRIND_MAX = 30;
