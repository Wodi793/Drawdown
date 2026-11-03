import { useEffect, useLayoutEffect, useRef, useState } from "preact/hooks";
import { grindLabel } from "../core/grind";
import { METHODS } from "../core/rules";
import { current, useStore } from "../data/store";
import { Bags } from "./Bags";
import { Brew } from "./Brew";
import { BagIcon, BrewIcon, Logo, RecipeIcon } from "./icons";
import { Recipe } from "./Recipe";

export type Tab = "brew" | "recipe" | "bags";
const TABS: Tab[] = ["brew", "recipe", "bags"];

const wideQ = "(min-width: 640px) and (orientation: landscape)";
const bigQ = "(min-width: 640px)";

function useMedia(q: string) {
  const [m, setM] = useState(() => matchMedia(q).matches);
  useEffect(() => {
    const mq = matchMedia(q), f = () => setM(mq.matches);
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, [q]);
  return m;
}

const fromHash = (): Tab => (TABS.includes(location.hash.slice(1) as Tab) ? (location.hash.slice(1) as Tab) : "brew");

export function App() {
  const s = useStore();
  const wide = useMedia(wideQ), big = useMedia(bigQ);
  const [tab, setTab] = useState<Tab>(fromHash);
  // Bags tab resets to its list each time it's opened.
  const [bagsKey, setBagsKey] = useState(0);

  useEffect(() => {
    const f = () => setTab(fromHash());
    addEventListener("hashchange", f);
    return () => removeEventListener("hashchange", f);
  }, []);

  // In the two-pane layout the recipe sits beside the ring, so "recipe" means "brew".
  const shown: Tab = wide && tab === "recipe" ? "brew" : tab;

  const go = (t: Tab) => {
    if (t === "bags") setBagsKey((k) => k + 1);
    setTab(t);
    if (location.hash !== `#${t}`) history.replaceState(null, "", `#${t}`);
  };

  // The bands are pinned to the screen edges; keep the content clear of them.
  const appRef = useRef<HTMLDivElement>(null), hdrRef = useRef<HTMLElement>(null), tabRef = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const app = appRef.current, hdr = hdrRef.current, tab = tabRef.current;
    if (!app || !hdr || !tab) return;
    const f = () => {
      app.style.setProperty("--hdr", `${hdr.offsetHeight}px`);
      app.style.setProperty("--tab", `${tab.offsetHeight}px`);
    };
    f();
    const ro = new ResizeObserver(f);
    ro.observe(hdr); ro.observe(tab);
    return () => ro.disconnect();
  }, [s.ready, wide, big]);

  if (!s.ready) return <div class="app" />;
  const { R } = current(s);

  return (
    <div ref={appRef} class={`app${wide ? " wide" : ""}${big ? " big" : ""}`}>
      <header class="appbar" ref={hdrRef}>
        <div class="in">
          <div class="row1">
            <h1 class="mark"><Logo />drawdown</h1>
            <span class="kit">V60 02</span>
          </div>
          <dl class="stats" aria-label="Current recipe">
            <div><dt>method</dt><dd>{METHODS[R.method].name}</dd></div>
            <div><dt>water</dt><dd>{R.water}g</dd></div>
            <div><dt>coffee</dt><dd>{R.dose}g</dd></div>
            <div><dt>Ode grind</dt><dd>{grindLabel(R.grind)}</dd></div>
            <div><dt>water °F</dt><dd>{R.temp}°</dd></div>
          </dl>
        </div>
      </header>

      <main class="main">
        <Brew hidden={shown !== "brew"} onPickBag={() => go("bags")} />
        <Recipe hidden={!(shown === "recipe" || (wide && shown === "brew"))} />
        {shown === "bags" && <Bags key={bagsKey} onBrew={() => go("brew")} />}
      </main>

      <nav class="tabbar" aria-label="Sections" ref={tabRef}>
        <div class="in">
          <button data-go="brew" aria-current={shown === "brew" ? "page" : undefined} onClick={() => go("brew")}><BrewIcon />Brew</button>
          <button data-go="recipe" aria-current={shown === "recipe" ? "page" : undefined} onClick={() => go("recipe")}><RecipeIcon />Recipe</button>
          <button data-go="bags" aria-current={shown === "bags" ? "page" : undefined} onClick={() => go("bags")}><BagIcon />Bags</button>
        </div>
      </nav>
      {s.toast && <div class="toast" role="status">{s.toast}</div>}
    </div>
  );
}
