// Spoken cues, beeps and screen wake lock.
// iOS only allows audio after a tap, so unlock() must run inside the Start tap.

let ctx: AudioContext | null = null;
let enabled = true;

export const setVoice = (on: boolean) => { enabled = on; };

export function unlock() {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    void ctx.resume();
  } catch { /* no audio */ }
  // Priming speech inside the tap lets later utterances play on iOS.
  if ("speechSynthesis" in window) {
    try { speechSynthesis.speak(new SpeechSynthesisUtterance("")); } catch { /* ignore */ }
  }
}

export function beep(freq = 880, ms = 90, vol = 0.25) {
  if (!enabled || !ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain(), n = ctx.currentTime;
    o.frequency.value = freq;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, n);
    g.gain.exponentialRampToValueAtTime(vol, n + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, n + ms / 1000);
    o.start(n); o.stop(n + ms / 1000 + 0.02);
  } catch { /* ignore */ }
}

/** Soft detent click for the water knob. */
export const tick = () => beep(1400, 25, 0.08);

export function say(text: string) {
  if (!enabled || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.05;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

export const hush = () => { try { speechSynthesis.cancel(); } catch { /* ignore */ } };

let lock: WakeLockSentinel | null = null;
export async function keepAwake() {
  try { lock = (await navigator.wakeLock?.request("screen")) ?? null; } catch { /* unsupported */ }
}
export function releaseAwake() {
  try { void lock?.release(); } catch { /* ignore */ }
  lock = null;
}
