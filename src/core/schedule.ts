import type { Resolved } from "./recipe";
import { clamp, r5 } from "./util";

export type StepKind = "pour" | "wait" | "swirl" | "draw";

export interface Step {
  kind: StepKind;
  /** Short name shown above the ring, e.g. "pour 2 of 4" */
  phase: string;
  /** Scale reading at the end of this step, grams */
  grams: number;
  /** Seconds; Infinity for the final drawdown */
  dur: number;
  /** Seconds from Start */
  start: number;
  /** Spoken at the start of the step */
  say: string;
  /** Instruction inside the ring */
  text: string;
  /** Label in the pour map */
  map: string;
}

type Draft = Omit<Step, "start">;

export function buildSteps(R: Resolved): Step[] {
  const W = R.water, D = R.dose, S: Draft[] = [];
  const pour = (phase: string, g: number, dur: number, say?: string, text?: string, map?: string) =>
    S.push({ kind: "pour", phase, grams: g, dur, say: say ?? `Pour to ${g} grams`, text: text ?? "Pour to", map: map ?? "Pour" });
  const wait = (phase: string, g: number, dur: number, say: string, text: string) =>
    S.push({ kind: "wait", phase, grams: g, dur, say, text, map: text });
  const swirl = (phase: string, dur: number, say: string, text: string, map: string) =>
    S.push({ kind: "swirl", phase, grams: W, dur, say, text, map });

  if (R.method === "classic") {
    // Bloom 3× dose, floored to 5 g; then 40%, then the last 60% in three equal parts.
    const bloom = Math.floor((D * 3) / 5) * 5;
    const p1 = r5(W * 0.4), rem = W - p1;
    const targets = [p1, r5(p1 + rem / 3), r5(p1 + (rem * 2) / 3), W];
    pour("bloom", bloom, 10, `Pour to ${bloom} grams, then swirl`, "Pour, then swirl", "Bloom pour, swirl");
    wait("bloom", bloom, 35, "Let it bloom", "Let it bloom");
    let prev = bloom;
    targets.forEach((t, i) => {
      pour(`pour ${i + 1} of 4`, t, Math.max(10, r5((t - prev) / 4.2)));
      if (i < 3) wait("pause", t, 10, "Pause", "Pause");
      prev = t;
    });
    swirl("swirl", 5, "Gentle swirl", "Gentle swirl", "Swirl");
  } else if (R.method === "mellow") {
    const bloom = Math.max(30, r5(D * 2)), p60 = r5(W * 0.6);
    pour("bloom", bloom, 10, `Pour to ${bloom} grams, then swirl to wet everything`, "Pour, then swirl", "Bloom pour, swirl");
    wait("bloom", bloom, 35, "Let it bloom", "Let it bloom");
    pour("main pour", p60, 30, `Pour to ${p60} grams, steady, over thirty seconds`, "Pour steadily to", "Pour, steady");
    pour("final pour", W, 30, `Slower now. Pour to ${W} grams`, "Pour slowly to", "Pour, slower");
    swirl("stir", 6, "Stir once each way with a spoon", "Stir once each way", "Stir once each way");
    swirl("swirl", 5, "Gentle swirl", "Gentle swirl", "Swirl");
  } else {
    // 4:6 — the first 40% split by `split`, the last 60% in three equal pours.
    const split = R.split ?? 0.5;
    const forty = W * 0.4, first = r5(forty * split), second = r5(forty), rest = W - second;
    const targets = [first, second, r5(second + rest / 3), r5(second + (rest * 2) / 3), W];
    const starts = [0, 45, 90, 130, 160];
    let prev = 0;
    targets.forEach((t, i) => {
      const dur = clamp(r5((t - prev) / 6), 10, 20);
      pour(i < 2 ? `pour ${i + 1} of 5 · balance` : `pour ${i + 1} of 5 · strength`, t, dur);
      if (i < 4) wait("wait", t, starts[i + 1] - starts[i] - dur, "Wait", "Let it drain");
      prev = t;
    });
  }
  S.push({ kind: "draw", phase: "drawdown", grams: W, dur: Infinity, say: "Let it drain. Tap drained when the bed is dry.", text: "Draining", map: "Drain" });

  let t = 0;
  return S.map((s) => { const step = { ...s, start: t }; t += s.dur; return step; });
}

/** Index of the step running at `elapsed` seconds. */
export function stepAt(steps: Step[], elapsed: number): number {
  const i = steps.findIndex((s) => elapsed >= s.start && elapsed < s.start + s.dur);
  return i < 0 ? steps.length - 1 : i;
}

/**
 * Countdown number to speak at this second, or null.
 * Steps of 10 s or more count down 5, 4, 3, 2, 1 before the next step.
 */
export function countdownAt(step: Step, elapsed: number): number | null {
  if (step.kind === "draw" || step.dur < 10) return null;
  const left = Math.ceil(step.start + step.dur - elapsed);
  return left >= 1 && left <= 5 ? left : null;
}
