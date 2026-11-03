import { useRef } from "preact/hooks";
import { baseGrind, grindLabel } from "../core/grind";
import { nudgeDose, nudgeGrind, nudgeSplit, nudgeTemp, setMethod, setWater } from "../core/recipe";
import { METHOD_IDS, METHODS, SPLIT_MAX, SPLIT_MIN, TEMP_MAX, TEMP_MIN, V60_02_CAPACITY_G, WATER_MAX, WATER_MIN, WATER_STEP } from "../core/rules";
import { fmt } from "../core/util";
import { tick, unlock } from "../brew/audio";
import { activeBag, current, editRecipe, toast, updateSettings, useStore } from "../data/store";

const WATERS: number[] = [];
for (let w = WATER_MIN; w <= WATER_MAX; w += WATER_STEP) WATERS.push(w);
const DEG = 270 / (WATERS.length - 1); // 22.5° per 25 g detent

function Knob({ water }: { water: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const drag = useRef<{ last: number; acc: number } | null>(null);
  const s = useStore();

  const step = (dir: number) => editRecipe((r) => {
    const w = Math.min(WATER_MAX, Math.max(WATER_MIN, r.water + dir * WATER_STEP));
    if (w !== r.water) tick();
    return setWater(r, w);
  });
  const angle = (e: PointerEvent) => {
    const b = ref.current!.getBoundingClientRect();
    return (Math.atan2(e.clientY - (b.top + b.height / 2), e.clientX - (b.left + b.width / 2)) * 180) / Math.PI;
  };

  const i = WATERS.indexOf(water), C = 120;
  const pt = (r: number, deg: number) => { const a = (deg * Math.PI) / 180; return [C + r * Math.sin(a), C - r * Math.cos(a)]; };
  const [dx, dy] = pt(56, -135 + i * DEG);

  return (
    <svg
      class="knob" ref={ref} viewBox="0 0 240 240" role="slider" tabIndex={0}
      aria-label="Water" aria-valuemin={WATER_MIN} aria-valuemax={WATER_MAX} aria-valuenow={water} aria-valuetext={`${water} grams`}
      onPointerDown={(e) => {
        if (s.running) { toast("Finish or reset the brew first"); return; }
        unlock();
        ref.current!.setPointerCapture(e.pointerId);
        drag.current = { last: angle(e), acc: 0 };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d) return;
        const a = angle(e);
        let delta = a - d.last;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        d.last = a;
        d.acc += delta;
        while (d.acc >= DEG) { step(1); d.acc -= DEG; }
        while (d.acc <= -DEG) { step(-1); d.acc += DEG; }
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight") { step(1); e.preventDefault(); }
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") { step(-1); e.preventDefault(); }
      }}
    >
      {WATERS.map((w, j) => {
        const a = -135 + j * DEG, major = w % 100 === 0;
        const [x1, y1] = pt(major ? 95 : 99, a), [x2, y2] = pt(110, a), [lx, ly] = pt(84, a);
        return (
          <g key={w}>
            <line class={`tick${major ? " major" : ""}${j <= i ? " on" : ""}`} x1={x1} y1={y1} x2={x2} y2={y2} />
            {major && <text class="tl" x={lx} y={ly}>{w}</text>}
          </g>
        );
      })}
      <circle class="body" cx={C} cy={C} r="70" />
      <circle class="dot" cx={dx} cy={dy} r="6" />
      <text class="kv" x={C} y={C - 4}>{water}</text>
      <text class="ku" x={C} y={C + 24}>grams water</text>
    </svg>
  );
}

function Stepper({ label, value, sub, minus, plus, onMinus, onPlus, minusOff, plusOff }: {
  label: string; value: string; sub?: string; minus: string; plus: string;
  onMinus: () => void; onPlus: () => void; minusOff?: boolean; plusOff?: boolean;
}) {
  return (
    <div class="cell">
      <span class="k">{label}{sub && <small>{sub}</small>}</span>
      <span class="v">
        <span class="val" aria-live="polite">{value}</span>
        <span class="stepper">
          <button aria-label={minus} onClick={onMinus} disabled={minusOff}>−</button>
          <button aria-label={plus} onClick={onPlus} disabled={plusOff}>+</button>
        </span>
      </span>
    </div>
  );
}

export function Recipe({ hidden }: { hidden: boolean }) {
  const s = useStore();
  const { R, steps, win } = current(s);
  const bag = activeBag(s);
  const sugg = baseGrind(R.method, R.water), off = R.grind - sugg;

  return (
    <section class="pane" id="recipe" hidden={hidden} aria-label="Recipe">
      <div class="page">
        <div>
          <h1 class="ptitle">Recipe</h1>
          <p class="note" style={{ marginLeft: 0 }}>
            {bag ? `For ${bag.name || bag.roaster}. Changes save to the bag.` : "Default recipe. Pick a bag to keep a recipe for it."}
          </p>
        </div>

        <section>
          <h2 class="gh">Water</h2>
          <div class="list"><div class="knobwrap"><Knob water={R.water} /></div></div>
          <p class="note">Spin the dial. 200 to 500 g in 25 g steps. Dose and grind follow the water.</p>
        </section>

        <section>
          <h2 class="gh">Method</h2>
          <div class="methods">
            {METHOD_IDS.map((m) => (
              <button key={m} class="method" aria-pressed={m === R.method} onClick={() => editRecipe((r) => setMethod(r, m))}>
                <b>{METHODS[m].name}</b><span>{METHODS[m].line}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 class="gh">Dial-in</h2>
          <div class="list">
            <Stepper label="Coffee" sub={`1:${R.ratio.toFixed(1)}`} value={`${R.dose} g`} minus="Less coffee" plus="More coffee"
              onMinus={() => editRecipe((r) => nudgeDose(r, -0.5))} onPlus={() => editRecipe((r) => nudgeDose(r, 0.5))} />
            <Stepper label="Ode grind" value={grindLabel(R.grind)} minus="Finer" plus="Coarser"
              sub={off === 0 ? `Suggested for ${R.water} g` : `${Math.abs(off)} step${Math.abs(off) > 1 ? "s" : ""} ${off < 0 ? "finer" : "coarser"} than ${grindLabel(sugg)}`}
              onMinus={() => editRecipe((r) => nudgeGrind(r, -1))} onPlus={() => editRecipe((r) => nudgeGrind(r, 1))} />
            <Stepper label="Water temp" sub={R.temp >= TEMP_MAX ? "At the boil for your altitude" : undefined} value={`${R.temp}°F`} minus="Cooler" plus="Hotter"
              minusOff={R.temp <= TEMP_MIN} plusOff={R.temp >= TEMP_MAX}
              onMinus={() => editRecipe((r) => nudgeTemp(r, -1))} onPlus={() => editRecipe((r) => nudgeTemp(r, 1))} />
            {R.method === "bright" && (
              <Stepper label="First pour" sub="Higher is brighter" value={`${Math.round((R.split ?? 0.5) * 100)}%`} minus="Sweeter" plus="Brighter"
                minusOff={(R.split ?? 0.5) <= SPLIT_MIN} plusOff={(R.split ?? 0.5) >= SPLIT_MAX}
                onMinus={() => editRecipe((r) => nudgeSplit(r, -0.05))} onPlus={() => editRecipe((r) => nudgeSplit(r, 0.05))} />
            )}
          </div>
          <p class="note">Coffee moves in half grams. Grind − is finer, + is coarser, one Ode detent at a time.</p>
          {R.dose > V60_02_CAPACITY_G && (
            <p class="note warn">{R.dose} g is more than a V60 02 holds comfortably (about {V60_02_CAPACITY_G} g). Use less water or dose down.</p>
          )}
        </section>

        <section>
          <h2 class="gh">Pour map</h2>
          <div class="list">
            {steps.map((st, k) => (
              <div class="cell step" key={k}>
                <span class="t">{fmt(st.start)}</span>
                <span class="a">{st.map}</span>
                <span class="g">{st.kind === "pour" ? `${st.grams} g` : ""}</span>
              </div>
            ))}
          </div>
          <p class="note">Aim to finish draining between {fmt(win[0])} and {fmt(win[1])}.</p>
        </section>

        <section>
          <div class="list">
            <div class="cell">
              <label class="k" for="voice">Spoken cues</label>
              <span class="switch">
                <input type="checkbox" id="voice" role="switch" checked={s.settings.voice} onChange={(e) => updateSettings({ voice: (e.target as HTMLInputElement).checked })} />
                <span />
              </span>
            </div>
          </div>
          <p class="note">Calls out each pour and counts down the last five seconds. Turn the ringer on if you hear nothing.</p>
        </section>
      </div>
    </section>
  );
}
