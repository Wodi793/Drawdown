import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import { defaultRecipe } from "../core/recipe";
import type { Bag, Brew, Settings } from "./types";

interface DrawdownDB extends DBSchema {
  bags: { key: string; value: Bag };
  brews: { key: string; value: Brew; indexes: { byBag: string } };
  settings: { key: string; value: Settings };
}

export const defaultSettings = (): Settings => ({ voice: true, activeBagId: null, defaultRecipe: defaultRecipe() });

/** Everything the app holds, loaded into memory at start. */
export interface Snapshot {
  bags: Bag[];
  brews: Brew[];
  settings: Settings;
}

/**
 * Storage backend. The installed app uses IndexedDB on the device;
 * the Claude-artifact build can swap in a different one.
 */
export interface Storage {
  load(): Promise<Snapshot>;
  putBag(b: Bag): Promise<void>;
  deleteBag(id: string): Promise<void>;
  putBrew(b: Brew): Promise<void>;
  putSettings(s: Settings): Promise<void>;
  /** Replace or merge everything at once (import). */
  bulk(s: Partial<Snapshot>): Promise<void>;
}

let dbp: Promise<IDBPDatabase<DrawdownDB>> | null = null;
const db = () =>
  (dbp ??= openDB<DrawdownDB>("drawdown", 1, {
    upgrade(d) {
      d.createObjectStore("bags", { keyPath: "id" });
      const brews = d.createObjectStore("brews", { keyPath: "id" });
      brews.createIndex("byBag", "bagId");
      d.createObjectStore("settings");
    },
    // A newer copy of the app (another tab, an update) needs the database: let go of it.
    blocking() { void dbp?.then((d) => d.close()); dbp = null; },
    terminated() { dbp = null; },
  }));

export const idbStorage: Storage = {
  async load() {
    const d = await db();
    const [bags, brews, settings] = await Promise.all([d.getAll("bags"), d.getAll("brews"), d.get("settings", "app")]);
    // Ask the browser not to clear our data under storage pressure.
    navigator.storage?.persist?.().catch(() => {});
    return { bags, brews, settings: { ...defaultSettings(), ...settings } };
  },
  async putBag(b) { await (await db()).put("bags", b); },
  async deleteBag(id) {
    const d = await db();
    const tx = d.transaction(["bags", "brews"], "readwrite");
    await tx.objectStore("bags").delete(id);
    const keys = await tx.objectStore("brews").index("byBag").getAllKeys(id);
    await Promise.all(keys.map((k) => tx.objectStore("brews").delete(k)));
    await tx.done;
  },
  async putBrew(b) { await (await db()).put("brews", b); },
  async putSettings(s) { await (await db()).put("settings", s, "app"); },
  async bulk(s) {
    const d = await db();
    const tx = d.transaction(["bags", "brews", "settings"], "readwrite");
    await Promise.all([
      ...(s.bags ?? []).map((b) => tx.objectStore("bags").put(b)),
      ...(s.brews ?? []).map((b) => tx.objectStore("brews").put(b)),
      ...(s.settings ? [tx.objectStore("settings").put(s.settings, "app")] : []),
    ]);
    await tx.done;
  },
};

/** In-memory fallback (private browsing, tests). Nothing survives a reload. */
export const memoryStorage = (): Storage => {
  let snap: Snapshot = { bags: [], brews: [], settings: defaultSettings() };
  return {
    async load() { return structuredClone(snap); },
    async putBag(b) { snap.bags = [...snap.bags.filter((x) => x.id !== b.id), b]; },
    async deleteBag(id) { snap.bags = snap.bags.filter((x) => x.id !== id); snap.brews = snap.brews.filter((x) => x.bagId !== id); },
    async putBrew(b) { snap.brews = [...snap.brews.filter((x) => x.id !== b.id), b]; },
    async putSettings(s) { snap.settings = s; },
    async bulk(s) { for (const b of s.bags ?? []) await this.putBag(b); for (const b of s.brews ?? []) await this.putBrew(b); if (s.settings) snap.settings = s.settings; },
  };
};
