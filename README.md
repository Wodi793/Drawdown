# Drawdown

A pour-over coffee coach for one setup: Hario V60 02, Fellow Ode Gen 2, Third Wave Water.
It times and speaks each pour, records the drawdown, asks how the cup tasted, and suggests
one change for next time. Each coffee bag keeps its own recipe and brew log.

**Live app:** https://wodi793.github.io/drawdown/ (install it: open in Safari → Share → Add to Home Screen)

## Where your data lives

On your phone only, inside the app's own storage. Nothing is sent anywhere. The code in this
repository is public; your bags and brews are not in it.

## How to change and redeploy the app

You don't need a computer.

1. Ask Claude (in Claude Code on the web or the app, with this repository selected) for the change.
2. Claude edits the code, runs the tests, and pushes to `main`.
3. GitHub automatically tests and publishes it. About two minutes later the live app updates.
   To watch: open this repository on github.com → **Actions** tab. A green check means it's live;
   a red X means a test failed and the old version is still live.
4. On your phone, close and reopen the app to get the new version.

## Where things are

| Folder | What's in it |
|---|---|
| `src/core/` | The coffee logic: recipe math, grind mapping, pour schedules, feedback rules. No screens. |
| `tests/` | Checks that the coffee logic gives the right numbers (e.g. Classic 450 g → 27 g, Ode 5.0, bloom 80 g). |
| `src/data/` | Saving bags, brews and settings on the device. |
| `src/brew/` | Spoken cues, beeps, keeping the screen awake. |
| `src/ui/` | The screens and the styling (colors are at the top of `styles.css`). |
| `.github/workflows/` | The automatic test-and-publish step. |

## For a developer

`npm install`, then `npm run dev` (local server), `npm test` (unit tests), `npm run build` (production build in `dist/`).
Stack: Vite, TypeScript, Preact, IndexedDB via `idb`. Fonts are bundled, so the app works offline.
