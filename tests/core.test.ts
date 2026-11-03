import { describe, expect, it } from "vitest";
import { ageBadge, daysOff } from "../src/core/age";
import { applySuggestion, NEUTRAL, suggest, type Ratings } from "../src/core/feedback";
import { baseGrind, grindLabel, parseGrind } from "../src/core/grind";
import {
  defaultRecipe, defaultSettings, nudgeDose, nudgeGrind, nudgeSplit, nudgeTemp, resolve,
  resolveSettings, setMethod, setWater, windowFor, type RecipeState,
} from "../src/core/recipe";
import { buildSteps, countdownAt, stepAt } from "../src/core/schedule";
import type { MethodId } from "../src/core/rules";

const recipe = (method: MethodId, water: number): RecipeState => ({ method, water, perMethod: {} });
const pours = (r: RecipeState) => buildSteps(resolve(r)).filter((s) => s.kind === "pour");

describe("grind", () => {
  it("maps index to Ode labels in thirds", () => {
    expect(grindLabel(0)).toBe("1.0");
    expect(grindLabel(11)).toBe("4.2");
    expect(grindLabel(12)).toBe("5.0");
    expect(grindLabel(30)).toBe("11.0");
  });
  it("parses labels back", () => {
    expect(parseGrind("5.0")).toBe(12);
    expect(parseGrind("4.2")).toBe(11);
    expect(parseGrind("6")).toBe(15);
    expect(parseGrind("12.0")).toBeNull();
    expect(parseGrind("abc")).toBeNull();
  });
  it("suggests 4.2 at 350 g and one step per 100 g", () => {
    expect(grindLabel(baseGrind("classic", 350))).toBe("4.2");
    expect(grindLabel(baseGrind("classic", 450))).toBe("5.0");
    expect(grindLabel(baseGrind("mellow", 450))).toBe("5.0");
    expect(grindLabel(baseGrind("classic", 250))).toBe("4.1");
    expect(grindLabel(baseGrind("bright", 450))).toBe("6.0");
  });
});

describe("recipe", () => {
  it("Classic 450 g → 27 g, 5.0, 210°F", () => {
    const R = resolve(recipe("classic", 450));
    expect(R).toMatchObject({ dose: 27, grind: 12, temp: 210, ratio: 16.7 });
  });
  it("Bright 450 g → 30 g at 1:15, 205°F, grind 6.0", () => {
    const R = resolve(recipe("bright", 450));
    expect(R).toMatchObject({ dose: 30, temp: 205, split: 0.5 });
    expect(grindLabel(R.grind)).toBe("6.0");
  });
  it("dose rounds to 0.5 g", () => {
    expect(resolve(recipe("classic", 300)).dose).toBe(18); // 17.96
    expect(resolve(recipe("classic", 325)).dose).toBe(19.5); // 19.46
  });
  it("dose nudges change the ratio and follow the water dial", () => {
    let r = nudgeDose(recipe("classic", 450), 0.5);
    expect(resolve(r).dose).toBe(27.5);
    expect(resolve(r).ratio).toBeCloseTo(16.364, 3);
    r = setWater(r, 300);
    expect(resolve(r).dose).toBe(18.5); // 300 / 16.364
  });
  it("grind nudges are stored relative to the suggested setting", () => {
    let r = nudgeGrind(recipe("classic", 450), -1);
    expect(grindLabel(resolve(r).grind)).toBe("4.2");
    r = setWater(r, 350);
    expect(grindLabel(resolve(r).grind)).toBe("4.1");
  });
  it("temperature never exceeds the 210°F boil", () => {
    const r = nudgeTemp(nudgeTemp(recipe("classic", 450), 1), 1);
    expect(resolve(r).temp).toBe(210);
  });
  it("first pour share stays within 35–65%", () => {
    let r = recipe("bright", 450);
    for (let i = 0; i < 10; i++) r = nudgeSplit(r, 0.05);
    expect(resolve(r).split).toBe(0.65);
  });
  it("each method keeps its own settings", () => {
    let r = nudgeTemp(recipe("classic", 450), -2);
    r = setMethod(r, "bright");
    expect(resolve(r).temp).toBe(205);
    r = setMethod(r, "classic");
    expect(resolve(r).temp).toBe(208);
  });
  it("default recipe is Classic 450 g", () => {
    expect(defaultRecipe()).toMatchObject({ method: "classic", water: 450 });
  });
});

describe("drawdown window", () => {
  it("Classic: 150 + (W − 200) × 0.15, 30 s wide", () => {
    expect(windowFor({ method: "classic", water: 200 })).toEqual([150, 180]);
    expect(windowFor({ method: "classic", water: 450 })).toEqual([188, 218]);
  });
  it("Mellow is Classic + 15 s", () => {
    expect(windowFor({ method: "mellow", water: 450 })).toEqual([203, 233]);
  });
  it("Bright is 3:15–3:45 at any water", () => {
    expect(windowFor({ method: "bright", water: 300 })).toEqual([195, 225]);
  });
});

describe("Classic schedule", () => {
  const steps = buildSteps(resolve(recipe("classic", 450)));
  it("blooms with 80 g, then pours to 180/270/360/450", () => {
    expect(pours(recipe("classic", 450)).map((s) => s.grams)).toEqual([80, 180, 270, 360, 450]);
  });
  it("bloom 0:00–0:10, rest to 0:45, pours of grams ÷ 4.2 rounded to 5, 10 s pauses", () => {
    const timeline = steps.map((s) => [s.kind, s.start, s.dur]);
    expect(timeline).toEqual([
      ["pour", 0, 10], ["wait", 10, 35],
      ["pour", 45, 25], ["wait", 70, 10],
      ["pour", 80, 20], ["wait", 100, 10],
      ["pour", 110, 20], ["wait", 130, 10],
      ["pour", 140, 20],
      ["swirl", 160, 5],
      ["draw", 165, Infinity],
    ]);
  });
  it("short pours last at least 10 s", () => {
    const small = buildSteps(resolve(recipe("classic", 200))).filter((s) => s.kind === "pour");
    expect(Math.min(...small.map((s) => s.dur))).toBeGreaterThanOrEqual(10);
  });
  it("speaks the pour target", () => {
    expect(steps[2].say).toBe("Pour to 180 grams");
  });
});

describe("Mellow schedule", () => {
  const steps = buildSteps(resolve(recipe("mellow", 450)));
  it("blooms 2× dose (min 30 g), to 60% by 1:15, 100% by 1:45, stir, swirl", () => {
    expect(steps.map((s) => [s.kind, s.grams, s.start, s.dur])).toEqual([
      ["pour", 55, 0, 10], ["wait", 55, 10, 35],
      ["pour", 270, 45, 30], ["pour", 450, 75, 30],
      ["swirl", 450, 105, 6], ["swirl", 450, 111, 5],
      ["draw", 450, 116, Infinity],
    ]);
  });
  it("bloom never drops below 30 g", () => {
    expect(pours(recipe("mellow", 200))[0].grams).toBe(30); // dose 12 → 24 → 30
  });
});

describe("Bright (4:6) schedule", () => {
  it("five pours at 0:00, 0:45, 1:30, 2:10, 2:40", () => {
    const p = pours(recipe("bright", 450));
    expect(p.map((s) => s.start)).toEqual([0, 45, 90, 130, 160]);
    expect(p.map((s) => s.grams)).toEqual([90, 180, 270, 360, 450]);
    expect(p.map((s) => s.dur)).toEqual([15, 15, 15, 15, 15]);
  });
  it("first pour share moves only the first two pours", () => {
    const R = resolveSettings("bright", 450, { ...defaultSettings("bright"), split: 0.65 });
    const p = buildSteps(R).filter((s) => s.kind === "pour");
    expect(p.map((s) => s.grams)).toEqual([115, 180, 270, 360, 450]);
  });
  it("pour durations stay within 10–20 s", () => {
    const p = pours(recipe("bright", 500));
    p.forEach((s) => { expect(s.dur).toBeGreaterThanOrEqual(10); expect(s.dur).toBeLessThanOrEqual(20); });
  });
});

describe("timer helpers", () => {
  const steps = buildSteps(resolve(recipe("classic", 450)));
  it("finds the running step", () => {
    expect(stepAt(steps, 0)).toBe(0);
    expect(stepAt(steps, 44.9)).toBe(1);
    expect(stepAt(steps, 45)).toBe(2);
    expect(stepAt(steps, 999)).toBe(steps.length - 1);
  });
  it("counts down 5…1 on steps of 10 s or more", () => {
    expect(countdownAt(steps[1], 39.5)).toBeNull(); // 6 s left
    expect(countdownAt(steps[1], 40.2)).toBe(5);
    expect(countdownAt(steps[1], 44.2)).toBe(1);
    expect(countdownAt(steps[1], 30)).toBeNull();
    const swirl = steps.find((s) => s.kind === "swirl")!;
    expect(countdownAt(swirl, swirl.start + 1)).toBeNull();
  });
});

describe("feedback engine", () => {
  const brew = (method: MethodId, drawdown: number, temp?: number) => {
    const p = { ...defaultSettings(method), ...(temp ? { temp } : {}) };
    return { ...resolveSettings(method, 450, p), drawdown };
  };
  const fb = (o: Partial<Ratings>): Ratings => ({ ...NEUTRAL, ...o });
  const FAST = 150, OK = 200, SLOW = 260; // Classic 450 window 188–218

  it("sour + slow → hotter water, unless already at the boil", () => {
    expect(suggest(fb({ ext: -1 }), brew("classic", SLOW, 205))).toMatchObject({ field: "temp", delta: 3, title: "Raise water to 208°F" });
    expect(suggest(fb({ ext: -1 }), brew("classic", SLOW, 209))).toMatchObject({ field: "temp", delta: 1 });
    expect(suggest(fb({ ext: -1 }), brew("classic", SLOW))).toMatchObject({ field: "grindOff", delta: -1, title: "Grind one step finer, to 4.2" });
  });
  it("sour otherwise → one step finer", () => {
    expect(suggest(fb({ ext: -2 }), brew("classic", OK))).toMatchObject({ field: "grindOff", delta: -1 });
    expect(suggest(fb({ ext: -1 }), brew("classic", FAST))).toMatchObject({ field: "grindOff", delta: -1 });
  });
  it("bitter + fast → 3°F cooler; otherwise coarser", () => {
    expect(suggest(fb({ ext: 1 }), brew("classic", FAST))).toMatchObject({ field: "temp", delta: -3, title: "Lower water to 207°F" });
    expect(suggest(fb({ ext: 1 }), brew("classic", OK))).toMatchObject({ field: "grindOff", delta: 1, title: "Grind one step coarser, to 5.1" });
  });
  it("flat: slow → coarser, fast → finer", () => {
    expect(suggest(fb({ acid: -1 }), brew("classic", SLOW))).toMatchObject({ field: "grindOff", delta: 1 });
    expect(suggest(fb({ acid: -1 }), brew("classic", FAST))).toMatchObject({ field: "grindOff", delta: -1 });
  });
  it("flat in window → bigger first pour (Bright) or weaker ratio", () => {
    expect(suggest(fb({ acid: -1 }), brew("bright", 210))).toMatchObject({ field: "split", delta: 0.05 });
    expect(suggest(fb({ acid: -1 }), brew("classic", OK))).toMatchObject({ field: "ratio", delta: 0.5, title: "Use a weaker ratio, 1:17.2" });
  });
  it("sharp → smaller first pour (Bright); slow → hotter; else finer", () => {
    expect(suggest(fb({ acid: 1 }), brew("bright", 210))).toMatchObject({ field: "split", delta: -0.05 });
    expect(suggest(fb({ acid: 1 }), brew("classic", SLOW, 205))).toMatchObject({ field: "temp", delta: 2 });
    expect(suggest(fb({ acid: 1 }), brew("classic", SLOW))).toMatchObject({ field: "grindOff", delta: -1 });
    expect(suggest(fb({ acid: 1 }), brew("classic", OK))).toMatchObject({ field: "grindOff", delta: -1 });
  });
  it("strength off → dose via ratio ±0.5", () => {
    expect(suggest(fb({ str: -1 }), brew("classic", OK))).toMatchObject({ field: "ratio", delta: -0.5, title: "Dose up: 28 g coffee (1:16.2)" });
    expect(suggest(fb({ str: 2 }), brew("classic", OK))).toMatchObject({ field: "ratio", delta: 0.5 });
  });
  it("muddy → coarser", () => {
    expect(suggest(fb({ clar: 1 }), brew("classic", OK))).toMatchObject({ field: "grindOff", delta: 1 });
  });
  it("all right → keep this recipe", () => {
    expect(suggest(fb({ overall: 4 }), brew("classic", OK))).toBeNull();
  });
  it("checks rules in order: extraction beats acidity beats strength", () => {
    expect(suggest(fb({ ext: 1, acid: -1, str: 1, clar: 2 }), brew("classic", OK))).toMatchObject({ field: "grindOff", delta: 1 });
    expect(suggest(fb({ acid: 1, str: -1 }), brew("classic", OK))).toMatchObject({ field: "grindOff", delta: -1 });
  });
  it("applying a suggestion respects the limits", () => {
    const p = defaultSettings("classic");
    expect(applySuggestion(p, { field: "temp", delta: 3 }).temp).toBe(210);
    expect(applySuggestion(p, { field: "ratio", delta: 0.5 }).ratio).toBe(17.2);
    expect(applySuggestion(p, { field: "grindOff", delta: -1 }).grindOff).toBe(-1);
  });
});

describe("roast age", () => {
  const now = new Date("2026-11-03T12:00:00").getTime();
  it("counts whole days", () => {
    expect(daysOff("2026-10-27", now)).toBe(7);
    expect(daysOff(undefined, now)).toBeNull();
    expect(daysOff("nope", now)).toBeNull();
  });
  it("badges: <7 Resting, 7–13 Opening, 14–35 Peak, >35 Fading", () => {
    expect(ageBadge(6)?.text).toBe("Day 6 · Resting");
    expect(ageBadge(7)?.cls).toBe("open");
    expect(ageBadge(13)?.cls).toBe("open");
    expect(ageBadge(14)?.cls).toBe("peak");
    expect(ageBadge(35)?.cls).toBe("peak");
    expect(ageBadge(36)?.cls).toBe("fade");
  });
});
