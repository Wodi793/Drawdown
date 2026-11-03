// iOS installed web apps report a viewport smaller than the screen (short by the clock/camera
// strip). Upright, 100lvh reaches the true bottom, and that height is the screen's long side.
// Remember it, and when the phone is sideways use it as the app's width.

const KEY = "drawdown.screenLong";
const standalone = () => matchMedia("(display-mode: standalone)").matches;

function probeHeight(): number {
  let el = document.getElementById("lvhProbe");
  if (!el) {
    el = document.createElement("div");
    el.id = "lvhProbe";
    document.body.appendChild(el);
  }
  return el.getBoundingClientRect().height;
}

function apply() {
  const root = document.documentElement;
  const clear = () => { root.style.removeProperty("--screen-w"); root.style.removeProperty("--strip"); };
  if (!standalone()) { clear(); return; }
  const upright = innerHeight >= innerWidth;
  if (upright) {
    const long = Math.round(probeHeight());
    if (long > 0) { try { localStorage.setItem(KEY, String(long)); } catch { /* ignore */ } }
    clear();
    return;
  }
  let long = 0;
  try { long = Number(localStorage.getItem(KEY)) || 0; } catch { /* ignore */ }
  // Only widen, and only by a plausible strip (up to 120 pt), in case the saved value is stale.
  if (long > innerWidth + 4 && long - innerWidth <= 120) {
    root.style.setProperty("--screen-w", `${long}px`);
    // Keep text and buttons out from under the clock/camera strip; only the colors reach the edge.
    root.style.setProperty("--strip", `${long - innerWidth}px`);
  } else clear();
}

export function watchScreen() {
  apply();
  addEventListener("resize", apply);
  addEventListener("orientationchange", () => setTimeout(apply, 300));
}
