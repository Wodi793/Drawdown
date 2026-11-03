import type { Ratings, Field } from "../core/feedback";
import type { RecipeState, Resolved } from "../core/recipe";
import type { MethodId } from "../core/rules";

export const SCHEMA_VERSION = 1;

/** Which brewer a brew was made on. Room for "aiden" later. */
export type Brewer = "v60-02";

export interface Bag {
  id: string;
  roaster: string;
  name: string;
  origin: string;
  variety: string;
  process: string;
  notes: string;
  elevation: string;
  /** YYYY-MM-DD */
  roastDate: string;
  /** Small JPEG data URL (~240 px) */
  photo?: string;
  /** This bag's own current recipe */
  recipe: RecipeState;
  /** Claude's stored suggestion (Phase 3) */
  analysis?: Analysis;
  createdAt: number;
  updatedAt: number;
}

export interface AnalysisOption {
  method: MethodId;
  /** Stored relative to the defaults so it rescales with the water dial */
  ratio: number;
  grindOff: number;
  temp: number;
  split: number | null;
  why: string;
}

export interface Analysis {
  /** Bumped when the defaults or the prompt change; older ones are stale */
  version: number;
  at: number;
  water: number;
  headline: string;
  reasons: string[];
  watch: string;
  best: AnalysisOption;
  brighter?: AnalysisOption;
  softer?: AnalysisOption;
}

export interface Brew extends Resolved {
  id: string;
  bagId: string | null;
  /** ISO timestamp */
  at: string;
  brewer: Brewer;
  /** Seconds from Start to Drained */
  drawdown: number;
  ratings?: Ratings;
  note: string;
  suggestion?: { field: Field; delta: number; title: string } | null;
  accepted: boolean;
  /** How the brew was recorded. A Bluetooth scale would add "scale". */
  source: "timer";
  /** Reserved for a scale: [seconds, grams] samples */
  trace?: [number, number][];
}

export interface Settings {
  voice: boolean;
  activeBagId: string | null;
  /** Recipe used when no bag is picked */
  defaultRecipe: RecipeState;
}
