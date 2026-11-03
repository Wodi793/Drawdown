import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { ageBadge, daysOff } from "../core/age";
import { applySuggestion, NEUTRAL, SCALES, suggest, type Ratings, type Suggestion } from "../core/feedback";
import { settingsFor } from "../core/recipe";
import { countdownAt, stepAt } from "../core/schedule";
import { fmt, uid } from "../core/util";
import { beep, hush, keepAwake, releaseAwake, say, setVoice, unlock } from "../brew/audio";
import { activeBag, current, editRecipe, saveBrew, setRunning, toast, useStore } from "../data/store";
import type { Brew as BrewRecord } from "../data/types";

const CIRC = 2 * Math.PI * 110;
const bagName = (b: { name: string; roaster: string } | null) => (b ? b.name || b.roaster || "Unnamed bag" : "");

type View = "stage" | "fb" | "sug";

export function Brew({ hidden, onPickBag }: { hidden: boolean; onPickBag: () => void }) {
  const s = useStore();
  const { R, steps, win } = current(s);
  const bag = activeBag(s);
  const age = ageBadge(bag ? daysOff(bag.roastDate) : null);

  const [view, setView] = useState<View>("stage");
  const [running, setRun] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [draft, setDraft] = useState<BrewRecord | null>(null);
  const [ratings, setRatings] = useState<Ratings>(NEUTRAL);
  const [note, setNote] = useState("");
  const [sug, setSug] = useState<Suggestion | null>(null);

  const t0 = useRef(0), raf = useRef(0), cur = useRef(-1), lastCount = useRef<number | null>(null);

  useEffect(() => setVoice(s.settings.voice), [s.settings.voice]);

  const frame = useCallback(() => {
    const el = (performance.now() - t0.current) / 1000;
    const i = stepAt(steps, el), st = steps[i];
    if (i !== cur.current) {
      cur.current = i;
      lastCount.current = null;
      say(st.say);
      beep(660, 140);
    }
    const c = countdownAt(st, el);
    if (c != null && c !== lastCount.current) {
      lastCount.current = c;
      say(String(c));
      beep(c === 1 ? 990 : 880);
    }
    setElapsed(el);
    raf.current = requestAnimationFrame(frame);
  }, [steps]);

  const stop = () => {
    cancelAnimationFrame(raf.current);
    hush();
    releaseAwake();
    setRun(false);
    setRunning(false);
  };

  const start = () => {
    if (running) return;
    unlock();
    void keepAwake();
    t0.current = performance.now();
    cur.current = -1;
    setElapsed(0);
    setRun(true);
    setRunning(true);
    raf.current = requestAnimationFrame(frame);
  };

  const reset = () => { stop(); setElapsed(0); setView("stage"); };

  const drained = () => {
    const el = (performance.now() - t0.current) / 1000;
    stop();
    say(`Drained at ${Math.floor(el / 60)} minutes ${Math.floor(el % 60)} seconds`);
    setDraft({
      ...R, id: uid("brew"), bagId: bag?.id ?? null, at: new Date().toISOString(), brewer: "v60-02",
      drawdown: Math.round(el), note: "", accepted: false, source: "timer",
    });
    setRatings(NEUTRAL);
    setNote("");
    setView("fb");
  };

  // Wake locks drop when the app is backgrounded; take it again on return.
  useEffect(() => {
    const f = () => { if (running && document.visibilityState === "visible") void keepAwake(); };
    document.addEventListener("visibilitychange", f);
    return () => document.removeEventListener("visibilitychange", f);
  }, [running]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const saveFeedback = async () => {
    if (!draft) return;
    const sg = suggest(ratings, draft);
    const rec: BrewRecord = { ...draft, ratings, note: note.trim(), suggestion: sg ? { field: sg.field, delta: sg.delta, title: sg.title } : null };
    await saveBrew(rec);
    setDraft(rec);
    setSug(sg);
    setView("sug");
  };

  const accept = async () => {
    if (!draft || !sug) return;
    editRecipe((r) => ({ ...r, perMethod: { ...r.perMethod, [draft.method]: applySuggestion(settingsFor(r, draft.method), sug) } }));
    await saveBrew({ ...draft, accepted: true });
    toast("Recipe updated for next time");
    reset();
  };

  // ---------- ring sizing: as large as the space allows ----------
  const stageRef = useRef<HTMLDivElement>(null), dialRef = useRef<HTMLDivElement>(null);
  const size = useCallback(() => {
    const st = stageRef.current, dial = dialRef.current;
    if (!st || !dial || !st.clientHeight) return;
    const cs = getComputedStyle(st), gap = parseFloat(cs.rowGap) || 10;
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const kids = [...st.children].filter((c) => c !== dial) as HTMLElement[];
    let px: number;
    if (cs.display === "grid") {
      const btns = kids.find((k) => k.classList.contains("buttons"))!;
      const others = kids.filter((k) => k !== btns);
      const cg = parseFloat(cs.columnGap) || 28;
      px = Math.min(st.clientWidth - btns.offsetWidth - cg - 8, st.clientHeight - pad - others.reduce((a, k) => a + k.offsetHeight, 0) - gap * 2 - 4);
    } else {
      px = Math.min(st.clientWidth * 0.92, st.clientHeight - pad - kids.reduce((a, k) => a + k.offsetHeight, 0) - gap * kids.length);
    }
    dial.style.width = `${Math.floor(Math.max(140, Math.min(px, 560)))}px`;
  }, []);
  useLayoutEffect(() => {
    const st = stageRef.current;
    if (!st) return;
    const ro = new ResizeObserver(size);
    ro.observe(st);
    return () => ro.disconnect();
  }, [size, view]);
  useLayoutEffect(size, [hidden, size]);

  // ---------- what the ring shows ----------
  const i = running ? stepAt(steps, elapsed) : -1;
  const st = i >= 0 ? steps[i] : null, nx = i >= 0 ? steps[i + 1] : null;
  let phase = "ready", instr = "Rinse, add coffee, tare", target = <>{R.dose}<small>g</small></>, count = <>coffee</>, frac = 0;
  if (st) {
    phase = st.phase;
    instr = st.text;
    if (st.kind === "draw") {
      target = <>{fmt(elapsed)}</>;
      frac = elapsed / win[1];
      count = elapsed < win[0] ? <>window opens {fmt(win[0])}</> : elapsed <= win[1] ? <b>in the window</b> : <>past {fmt(win[1])}</>;
    } else {
      target = <>{st.grams}<small>g</small></>;
      frac = (elapsed - st.start) / st.dur;
      const left = Math.ceil(st.start + st.dur - elapsed), c = countdownAt(st, elapsed);
      count = c != null ? <b>{c}</b> : <>{left}s</>;
    }
  }
  const next = !st ? "" : nx ? `Next: ${nx.kind === "pour" ? `pour to ${nx.grams} g` : nx.map.toLowerCase()}` : `Aim for ${fmt(win[0])}–${fmt(win[1])}`;
  const canDrain = st?.kind === "draw";

  return (
    <section class="pane" id="brew" hidden={hidden} aria-label="Brew">
      {view === "stage" && <>
        <div class="brewbar">
          <button class="pill" onClick={() => (running ? toast("Finish or reset the brew first") : onPickBag())} aria-label={bag ? `Bag: ${bagName(bag)}. Tap to change.` : "No bag. Tap to pick one."}>
            <span>{bag ? bagName(bag) : "No bag · tap to pick"}</span>
          </button>
          {age && <span class={`age ${age.cls}`}>{age.text}</span>}
        </div>
        <div class="stage" ref={stageRef}>
          <span class="phase" aria-live="polite">{phase}</span>
          <div class={`dial${canDrain ? " draw" : ""}`} ref={dialRef} role="timer" aria-label={st ? `${instr} ${st.kind === "draw" ? "" : `${st.grams} grams`}` : `Ready. ${R.dose} grams of coffee.`}>
            <svg viewBox="0 0 240 240" aria-hidden="true">
              <circle class="track" cx="120" cy="120" r="110" />
              <circle class="prog" cx="120" cy="120" r="110" style={{ strokeDasharray: CIRC, strokeDashoffset: CIRC * (1 - Math.min(1, Math.max(0, frac))) }} />
            </svg>
            <div class="inner" aria-hidden="true">
              <p class="instr">{instr}</p>
              <div class="target">{target}</div>
              <div class="count">{count}</div>
            </div>
          </div>
          <div class={`meta${running ? "" : " rest"}`}><span class="clk">{fmt(elapsed)}</span><span>{next}</span></div>
          <div class="buttons">
            <button class="round" onClick={reset}>Reset</button>
            <button class="round done" onClick={drained} disabled={!canDrain}>Drained</button>
            <button class="round go" onClick={start} disabled={running}>Start</button>
          </div>
        </div>
      </>}

      {view === "fb" && draft && (
        <div class="fb">
          <div>
            <h1>How was it?</h1>
            <p class="note" style={{ marginLeft: 0 }}>
              Drained at {fmt(draft.drawdown)}, {draft.drawdown < win[0] ? "a little fast" : draft.drawdown > win[1] ? "a little slow" : "in the window"} (target {fmt(win[0])}–{fmt(win[1])}). Leave anything that tasted right in the middle.
            </p>
          </div>
          {SCALES.map((sc) => (
            <fieldset class="scale" key={sc.key}>
              <legend><div class="lab"><b>{sc.name}</b>{sc.ends && <span>{sc.ends[0]} ↔ {sc.ends[1]}</span>}</div></legend>
              <div class="dots">
                {sc.options.map((o) => (
                  <button key={o.value} aria-pressed={ratings[sc.key] === o.value} onClick={() => setRatings({ ...ratings, [sc.key]: o.value })}>{o.label}</button>
                ))}
              </div>
            </fieldset>
          ))}
          <textarea aria-label="Notes" placeholder="Notes (what you tasted)" value={note} onInput={(e) => setNote((e.target as HTMLTextAreaElement).value)} />
          <div class="btnrow">
            <button class="btn" onClick={reset}>Skip</button>
            <button class="btn fill" onClick={saveFeedback}>Save brew</button>
          </div>
        </div>
      )}

      {view === "sug" && (
        <div class="fb">
          <h1>Next brew</h1>
          {sug ? <>
            <div class="card">
              <p class="muted">Change one thing</p>
              <h3>{sug.title}</h3>
              <p>{sug.why}</p>
              <p class="muted">Everything else stays the same, so you'll know whether this change helped.</p>
            </div>
            <div class="btnrow">
              <button class="btn" onClick={reset}>Keep current</button>
              <button class="btn fill" onClick={accept}>Use this</button>
            </div>
          </> : <>
            <div class="card">
              <h3>Keep this recipe</h3>
              <p>Extraction, acidity, strength and clarity all landed where you wanted. {bag ? "This brew is saved to the bag." : "This brew is saved."}</p>
            </div>
            <div class="btnrow"><button class="btn fill" onClick={reset}>Done</button></div>
          </>}
        </div>
      )}
    </section>
  );
}
