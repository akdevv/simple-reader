# Extension Build Plan

Step-by-step plan for building the Simple Reader extension yourself.
`ext-reference/` is a complete working version — use it to check your work
or unblock yourself, not to copy blindly. Each step ends with something you
can run and see working.

**The idea:** popup with player controls → local Piper TTS reads the page
aloud → the sentence being spoken is highlighted in place on the page.

**Architecture** (MV3 forces most of this):

```
popup ──sr:start──▶ background ──sr:extract──▶ content script
                        │                          │ (extracts sentences
                        │◀──────sr:sentences───────┘  + owns highlighting)
                        │
                  sr:generate
                        ▼
                 offscreen document ──▶ web worker (Piper TTS inference)
                 (owns <audio>, state)
```

Why: service workers can't play audio (→ offscreen doc), TTS inference
would freeze playback (→ worker), and pages can't be trusted to keep DOM
references across contexts (→ content script owns the Ranges).

---

## Step 1 — Scaffold

```sh
pnpm dlx create-crxjs extension -t vanilla-ts
```

Strip it to a hello-world popup: delete sidepanel/, content/, assets/,
counter demo. Trim `manifest.config.ts` to just the popup action.

- Reference: `ext-reference/manifest.config.ts`, `src/popup/index.html`
- Gotcha: with zero .ts files under src/, `tsc` errors — keep at least one,
  or include `*.config.ts` in tsconfig.
- ✅ Check: `pnpm build`, load `dist/` via chrome://extensions → popup opens.

## Step 2 — Shared contracts

Write the two files every context imports:

- `src/shared/messages.ts` — one `Message` union for all cross-context
  messages, plus `ReaderState` (phase/index/total/progress). Design this
  first; it IS the architecture.
- `src/shared/settings.ts` — `{ speed }`, persisted in chrome.storage.local.

- Reference: `ext-reference/src/shared/`
- ✅ Check: `pnpm build` still passes (nothing uses them yet).

## Step 3 — Content script: extraction

`src/content/main.ts`: walk visible `p, h1-h6, li, blockquote` blocks
(skip nav/header/footer/aside), normalize whitespace, split into sentences,
and build a DOM `Range` per sentence. Store ranges on `window`, send texts
back via `sr:sentences`.

The tricky part: keeping a char→(textNode, offset) map during
normalization so each sentence maps back to an exact Range.

- Reference: `ext-reference/src/content/main.ts` (`extractFromBlock`),
  `src/lib/split-sentences.ts`
- Gotcha: sentence splitter must not break on "Dr.", "3.14", "e.g."
- ✅ Check: temp popup button that sends `sr:extract` and console.logs the
  sentences from a real article.

## Step 4 — Content script: highlighting

`sr:highlight {index}` → `CSS.highlights.set()` with that sentence's Range
(native Custom Highlight API — zero DOM mutation); scroll it into view if
off-screen. `sr:clear` → remove. Style via `::highlight(name)` in content.css.

- Reference: same file, `highlight()` + `src/content/content.css`
- ✅ Check: from the popup, highlight sentence #5 on a page. It glows.

## Step 5 — Background orchestrator

`src/background/index.ts`: on `sr:start` → find active tab (reject
chrome:// etc.), create offscreen doc, send `sr:extract`. Relay
`sr:sentences` → `sr:generate`, and `sr:state` → `sr:highlight`/`sr:clear`
to the reading tab. Stop playback when the tab closes.

- Reference: `ext-reference/src/background/index.ts`
- Gotcha: name the file uniquely (index.ts, not main.ts) — CRXJS keys
  chunks by entry basename; a collision wires the SW loader to the wrong
  chunk → "Service worker registration failed. Status code: 15".
- ✅ Check: SW registers; sr:start round-trips (log in each context).

## Step 6 — Offscreen doc + TTS worker

The big one. Two files:

- `src/offscreen/tts-worker.ts` — Piper inference via
  `@mintplex-labs/piper-tts-web` + `onnxruntime-web@1.18.0` (pin it).
  init → ready/progress, predict(id, text) → wav ArrayBuffer.
- `src/offscreen/main.ts` — owns the `<audio>` element and `ReaderState`.
  Generate sentences sequentially, cache wavs (Cache API, 6h TTL), start
  playing at sentence 0 as soon as it's ready, broadcast `sr:state` on
  every change. Controls: toggle/next/prev/stop + seek.

Infra this needs (all in `ext-reference/vite.config.ts` + manifest):
- wasm copy plugin: ort + piper phonemizer wasm must ship in the bundle
  (CSP blocks CDNs); offscreen points at them via `chrome.runtime.getURL`
- manifest: `offscreen` permission + CSP `wasm-unsafe-eval`
- offscreen/index.html as an extra rollup input (CRXJS can't see it)
- pin ort threads to 1 (threaded ort spawns blob: workers — CSP blocks)

- Reference: `ext-reference/src/offscreen/` — read main.ts's session
  counter (aborts stale generation) and the null/""/url states of
  audioUrls (pending/failed/ready) before writing your own.
- ✅ Check: `pnpm build`, reload, click read on an article — audio plays,
  sentences highlight along. First run downloads the voice (~60MB, once).

## Step 7 — Real popup UI

Views driven by `ReaderState.phase`: idle → "Read this page", loading
(spinner + model download %), player (prev / play-pause / next + speed
cycle button + progress bar), error (+ retry). On open: render idle
immediately, then `sr:get-state` to catch a session already running.

- Reference: `ext-reference/src/popup/`
- ✅ Check: full flow from the popup; speed change applies immediately.

## Step 8 — On-page controls

In the content script, while reading is active (track via
highlight/clear messages):

- keyboard: space = toggle, ←/→ = prev/next — but never when typing
  (input/textarea/contenteditable) and never with modifier keys held
- click a sentence → jump there: `caretRangeFromPoint(x, y)` → find which
  stored Range contains that point → `sr:seek {index}`; ignore clicks on
  links/buttons/forms

- Reference: `ext-reference/src/content/main.ts` (`onKeydown`, `onClick`)
- ✅ Check: space pauses mid-article; clicking a paragraph jumps the voice.

---

## Order of debugging pain (from building the reference)

1. SW status code 15 → entry basename collision (step 5 gotcha)
2. TTS silently dead in dev → wasm only copied on `pnpm build`, not dev
3. ort crashes spawning workers → threads not pinned to 1
4. Offscreen can't read chrome.storage → settings must be *pushed* to it
   (`sr:settings` from popup; `sr:get-settings` request on startup)
5. Audio playbackRate resets when src changes → set it on every play
