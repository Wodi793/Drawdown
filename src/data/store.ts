import { useLayoutEffect, useState } from "preact/hooks";
import { resolve, windowFor, type RecipeState, type Resolved } from "../core/recipe";
import { buildSteps, type Step } from "../core/schedule";
import { defaultSettings, idbStorage, memoryStorage, type Storage } from "./db";
import type { Bag, Brew, Settings } from "./types";

export interface State {
  ready: boolean;
  /** Saved only on this device, or not at all (storage blocked) */
  persistent: boolean;
  bags: Bag[];
  brews: Brew[];
  settings: Settings;
  /** True while the timer runs: recipe edits are locked */
  running: boolean;
  toast: string | null;
}

let storage: Storage = idbStorage;
let state: State = { ready: false, persistent: true, bags: [], brews: [], settings: defaultSettings(), running: false, toast: null };
const subs = new Set<() => void>();

function set(patch: Partial<State>) {
  state = { ...state, ...patch };
  subs.forEach((f) => f());
}

export const getState = () => state;

/** Re-render the calling component whenever the store changes. */
export function useStore(): State {
  const [, bump] = useState(0);
  const seen = state;
  // Subscribe before paint, then catch any change that landed between render and now.
  // (Without this, data that loads very fast could leave the screen blank.)
  useLayoutEffect(() => {
    const f = () => bump((n) => n + 1);
    subs.add(f);
    if (state !== seen) f();
    return () => { subs.delete(f); };
  }, []);
  return state;
}

export async function init(s?: Storage) {
  if (s) storage = s;
  try {
    // Never leave a blank screen: if the database doesn't open in 5 s, run without it.
    const snap = await Promise.race([
      storage.load(),
      new Promise<never>((_, rej) => setTimeout(() => rej(new Error("storage timeout")), 5000)),
    ]);
    set({ ...snap, bags: sortBags(snap.bags), brews: sortBrews(snap.brews), ready: true });
  } catch {
    storage = memoryStorage();
    set({ ready: true, persistent: false });
  }
}

const sortBags = (b: Bag[]) => [...b].sort((x, y) => y.updatedAt - x.updatedAt);
const sortBrews = (b: Brew[]) => [...b].sort((x, y) => y.at.localeCompare(x.at));
const fail = () => toast("Couldn't save on this device. Storage may be full.");

// ---------- derived ----------

export const activeBag = (s: State = state) => s.bags.find((b) => b.id === s.settings.activeBagId) ?? null;
export const currentRecipe = (s: State = state): RecipeState => activeBag(s)?.recipe ?? s.settings.defaultRecipe;
export const brewsFor = (bagId: string, s: State = state) => s.brews.filter((b) => b.bagId === bagId);

let memo: { r: RecipeState; out: { R: Resolved; steps: Step[]; win: [number, number] } } | null = null;
/** Resolved recipe, pour steps and drawdown window for the current context. */
export function current(s: State = state) {
  const r = currentRecipe(s);
  if (memo?.r !== r) {
    const R = resolve(r);
    memo = { r, out: { R, steps: buildSteps(R), win: windowFor(R) } };
  }
  return memo.out;
}

// ---------- actions ----------

let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  clearTimeout(toastTimer);
  set({ toast: msg });
  toastTimer = setTimeout(() => set({ toast: null }), 2600);
}

export const setRunning = (running: boolean) => set({ running });

let saveTimer: ReturnType<typeof setTimeout> | undefined;
/** Change the current recipe (active bag's, or the default). Saves shortly after. */
export function editRecipe(fn: (r: RecipeState) => RecipeState) {
  if (state.running) { toast("Finish or reset the brew first"); return; }
  const bag = activeBag();
  const next = fn(currentRecipe());
  if (bag) {
    const nb = { ...bag, recipe: next, updatedAt: Date.now() };
    set({ bags: sortBags(state.bags.map((b) => (b.id === bag.id ? nb : b))) });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => storage.putBag(nb).catch(fail), 400);
  } else {
    const ns = { ...state.settings, defaultRecipe: next };
    set({ settings: ns });
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => storage.putSettings(ns).catch(fail), 400);
  }
}

export function updateSettings(patch: Partial<Settings>) {
  const ns = { ...state.settings, ...patch };
  set({ settings: ns });
  storage.putSettings(ns).catch(fail);
}

export const selectBag = (id: string | null) => updateSettings({ activeBagId: id });

export async function saveBag(bag: Bag) {
  const nb = { ...bag, updatedAt: Date.now() };
  set({ bags: sortBags([...state.bags.filter((b) => b.id !== nb.id), nb]) });
  await storage.putBag(nb).catch(fail);
}

export async function deleteBag(id: string) {
  set({ bags: state.bags.filter((b) => b.id !== id), brews: state.brews.filter((b) => b.bagId !== id) });
  if (state.settings.activeBagId === id) updateSettings({ activeBagId: null });
  await storage.deleteBag(id).catch(fail);
}

export async function saveBrew(brew: Brew) {
  set({ brews: sortBrews([...state.brews.filter((b) => b.id !== brew.id), brew]) });
  await storage.putBrew(brew).catch(fail);
}

/** Replace the stored data wholesale (used by import). */
export async function importData(bags: Bag[], brews: Brew[]) {
  await storage.bulk({ bags, brews });
  const byId = new Map(state.bags.map((b) => [b.id, b]));
  bags.forEach((b) => byId.set(b.id, b));
  const brewById = new Map(state.brews.map((b) => [b.id, b]));
  brews.forEach((b) => brewById.set(b.id, b));
  set({ bags: sortBags([...byId.values()]), brews: sortBrews([...brewById.values()]) });
}
