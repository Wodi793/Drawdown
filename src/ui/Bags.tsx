import { useState } from "preact/hooks";
import { ageBadge, daysOff } from "../core/age";
import { RATING_LABEL } from "../core/feedback";
import { grindLabel } from "../core/grind";
import { resolve } from "../core/recipe";
import { METHODS } from "../core/rules";
import { fmt, uid } from "../core/util";
import { brewsFor, deleteBag, getState, saveBag, selectBag, toast, useStore } from "../data/store";
import type { Bag } from "../data/types";

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const bagName = (b: Bag) => b.name || b.roaster || "Unnamed bag";
const bagSub = (b: Bag) => [b.roaster, b.origin, b.process].filter(Boolean).join(" · ") || "No details yet";

const FIELDS: [keyof Bag & string, string][] = [
  ["roaster", "Roaster"], ["name", "Coffee or producer"], ["origin", "Origin"], ["variety", "Variety"],
  ["process", "Process"], ["notes", "Tasting notes"], ["elevation", "Elevation"],
];

type View = { k: "list" } | { k: "edit"; id: string | null } | { k: "view"; id: string };

export function Bags({ onBrew }: { onBrew: () => void }) {
  const [v, setV] = useState<View>({ k: "list" });
  const show = (nv: View) => { setV(nv); document.getElementById("bags")?.scrollTo(0, 0); };
  return (
    <section class="pane" id="bags" aria-label="Bags">
      {v.k === "list" && <BagList onOpen={(id) => show({ k: "view", id })} onAdd={() => show({ k: "edit", id: null })} />}
      {v.k === "edit" && <BagEdit id={v.id} onDone={(id) => show(id ? { k: "view", id } : { k: "list" })} />}
      {v.k === "view" && <BagView id={v.id} onBack={() => show({ k: "list" })} onEdit={() => show({ k: "edit", id: v.id })} onBrew={onBrew} />}
    </section>
  );
}

function Thumb({ bag }: { bag: Bag }) {
  return <span class="thumb">{bag.photo && <img alt="" src={bag.photo} />}</span>;
}

function BagList({ onOpen, onAdd }: { onOpen: (id: string) => void; onAdd: () => void }) {
  const s = useStore();
  return (
    <div class="page">
      <h1>Bags</h1>
      {s.bags.length ? (
        <div class="list">
          {s.bags.map((b) => {
            const a = ageBadge(daysOff(b.roastDate)), n = brewsFor(b.id, s).length;
            return (
              <button key={b.id} class={`bag${b.id === s.settings.activeBagId ? " active" : ""}`} onClick={() => onOpen(b.id)}
                aria-label={`${bagName(b)}${b.id === s.settings.activeBagId ? ", brewing now" : ""}`}>
                <Thumb bag={b} />
                <span class="m">
                  <b>{bagName(b)}</b>
                  <span>{bagSub(b)}</span>
                  <span>{a ? `${a.text} · ` : ""}{n} brew{n === 1 ? "" : "s"}</span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div class="empty"><b>No bags yet</b>Add the coffee you're brewing. Each bag keeps its own recipe and brew log.</div>
      )}
      <button class="btn fill" onClick={onAdd}>Add a bag</button>
      <p class="note">{s.persistent ? "Saved on this phone only." : "Couldn't open your saved bags, so nothing will be kept this time. Close other Drawdown windows and reopen the app."}</p>
    </div>
  );
}

// ---------- photos ----------
function loadImg(f: Blob): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const u = URL.createObjectURL(f), i = new Image();
    i.onload = () => { URL.revokeObjectURL(u); res(i); };
    i.onerror = rej;
    i.src = u;
  });
}
async function shrink(f: Blob, max: number, q: number) {
  const i = await loadImg(f), k = Math.min(1, max / Math.max(i.width, i.height));
  const c = document.createElement("canvas");
  c.width = Math.round(i.width * k); c.height = Math.round(i.height * k);
  c.getContext("2d")!.drawImage(i, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", q);
}

function BagEdit({ id, onDone }: { id: string | null; onDone: (id: string | null) => void }) {
  const [b, setB] = useState<Bag>(() => {
    const ex = id ? getState().bags.find((x) => x.id === id) : null;
    if (ex) return structuredClone(ex);
    const now = Date.now();
    return { id: uid("bag"), roaster: "", name: "", origin: "", variety: "", process: "", notes: "", elevation: "", roastDate: "",
      recipe: structuredClone(getState().settings.defaultRecipe), createdAt: now, updatedAt: now };
  });
  const [status, setStatus] = useState("The photo becomes the bag's picture.");
  const set = (k: keyof Bag, val: string) => setB({ ...b, [k]: val });

  const save = async () => {
    const clean = { ...b };
    FIELDS.forEach(([k]) => { (clean as Record<string, unknown>)[k] = String(clean[k] ?? "").trim(); });
    if (!clean.name && !clean.roaster) { toast("Add at least the roaster or the coffee's name"); return; }
    const isNew = !getState().bags.some((x) => x.id === clean.id);
    await saveBag(clean);
    if (isNew) selectBag(clean.id);
    onDone(clean.id);
  };

  return (
    <div class="page">
      <button class="back" onClick={() => onDone(id)}>‹ {id ? "Bag" : "Bags"}</button>
      <h1>{id ? "Edit bag" : "Add a bag"}</h1>
      <section class="hero">
        <Thumb bag={b} />
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "8px", minWidth: 0 }}>
          <label class="btn">
            {b.photo ? "Retake photo" : "Photo of the label"}
            <input type="file" accept="image/*" class="sr" onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (!f) return;
              try { setB({ ...b, photo: await shrink(f, 240, 0.72) }); setStatus("Photo added."); }
              catch { setStatus("Couldn't open that photo. Try another."); }
            }} />
          </label>
          <div class="status" role="status">{status}</div>
        </div>
      </section>
      <section>
        <div class="list">
          {FIELDS.map(([k, label]) => (
            <div class="cell" key={k}>
              <label class="k" for={`f_${k}`}>{label}</label>
              <span class="v" style={{ flex: 1 }}>
                <input id={`f_${k}`} value={String(b[k] ?? "")} onInput={(e) => set(k, (e.target as HTMLInputElement).value)} autocomplete="off" />
              </span>
            </div>
          ))}
          <div class="cell">
            <label class="k" for="f_roastDate">Roast date</label>
            <span class="v"><input type="date" id="f_roastDate" value={b.roastDate} style={{ width: "auto" }} onInput={(e) => set("roastDate", (e.target as HTMLInputElement).value)} /></span>
          </div>
        </div>
        <p class="note">Roast date drives the day count. Light roasts usually peak around days 14 to 35.</p>
      </section>
      <button class="btn fill" onClick={save}>Save bag</button>
    </div>
  );
}

function BagView({ id, onBack, onEdit, onBrew }: { id: string; onBack: () => void; onEdit: () => void; onBrew: () => void }) {
  const s = useStore();
  const [armed, setArmed] = useState(false);
  const b = s.bags.find((x) => x.id === id);
  if (!b) return <div class="page"><button class="back" onClick={onBack}>‹ Bags</button><div class="empty">This bag is gone.</div></div>;

  const a = ageBadge(daysOff(b.roastDate)), R = resolve(b.recipe), brews = brewsFor(id, s);
  const best = [...brews].filter((x) => (x.ratings?.overall ?? 0) >= 3)
    .sort((x, y) => (y.ratings!.overall - x.ratings!.overall) || y.at.localeCompare(x.at))[0];
  const extra = ([["Elevation", b.elevation], ["Roasted", b.roastDate]] as const).filter((x) => x[1]);

  return (
    <div class="page">
      <button class="back" onClick={onBack}>‹ Bags</button>
      <div class="hero">
        <Thumb bag={b} />
        <div style={{ minWidth: 0 }}>
          <h1>{bagName(b)}</h1>
          {b.name && b.roaster && <p>{b.roaster}</p>}
          {a && <span class={`age ${a.cls}`}>{a.text}</span>}
        </div>
      </div>
      <button class="btn fill" onClick={() => {
        if (s.running) { toast("Finish or reset the brew first"); return; }
        selectBag(id); onBrew();
      }}>{s.settings.activeBagId === id ? "Brew this bag" : "Brew with this bag"}</button>

      {(b.origin || b.process || b.notes || b.variety) && (
        <section class="sticker" aria-label="Label">
          <h3>{bagName(b)}</h3>
          {b.variety && <div class="sub">{b.variety}</div>}
          {(b.origin || b.process) && (
            <ul>
              {b.origin && <li><b>Origin:</b> {b.origin}</li>}
              {b.process && <li><b>Process:</b> {b.process}</li>}
            </ul>
          )}
          {b.notes && <div><b>Notes:</b> {b.notes}</div>}
        </section>
      )}
      {extra.length > 0 && (
        <div class="list">
          {extra.map(([k, val]) => <div class="cell" key={k}><span class="k">{k}</span><span class="v">{val}</span></div>)}
        </div>
      )}

      <section>
        <h2 class="gh">Current recipe</h2>
        <div class="card">
          <h3>{METHODS[R.method].name} · {R.dose} g : {R.water} g</h3>
          <p class="muted">Grind {grindLabel(R.grind)} · {R.temp}°F · 1:{R.ratio.toFixed(1)}{R.method === "bright" ? ` · first pour ${Math.round((R.split ?? 0.5) * 100)}%` : ""}</p>
          {best && <p>Best so far: {day(best.at)} · {RATING_LABEL[best.ratings!.overall]} · drained {fmt(best.drawdown)}{best.note ? ` · “${best.note}”` : ""}</p>}
        </div>
      </section>

      <section>
        <h2 class="gh">Brews</h2>
        {brews.length ? (
          <div class="list loglist">
            {brews.map((x) => (
              <div class="cell" key={x.id}>
                <div class="r1">
                  <span>{day(x.at)} · {METHODS[x.method]?.name ?? ""} · {x.dose} g : {x.water} g</span>
                  <span>{fmt(x.drawdown)}</span>
                </div>
                <div class="r2">Grind {grindLabel(x.grind)} · {x.temp}°F · {x.ratings ? RATING_LABEL[x.ratings.overall] : "No rating"}{x.note ? ` · ${x.note}` : ""}</div>
                {x.suggestion && <div class="r2">{x.accepted ? "Changed" : "Suggested"}: {x.suggestion.title}</div>}
              </div>
            ))}
          </div>
        ) : <div class="empty">No brews logged yet. Brew this bag, tap Drained, and rate the cup.</div>}
      </section>

      <div class="btnrow">
        <button class="btn" onClick={onEdit}>Edit details</button>
        <button class="btn danger" onClick={async () => {
          if (!armed) { setArmed(true); setTimeout(() => setArmed(false), 3000); return; }
          await deleteBag(id); toast("Bag deleted"); onBack();
        }}>{armed ? "Tap again to delete" : "Delete bag"}</button>
      </div>
    </div>
  );
}
