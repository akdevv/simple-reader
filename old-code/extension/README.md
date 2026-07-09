# Simple Reader — Browser Extension

Reads any webpage aloud with the Piper TTS model running **fully locally in the
browser** (WASM — no server, no API keys). Highlights the sentence
being spoken **in place on the page** using the native CSS Custom Highlight API.

## Build

```bash
pnpm install        # from repo root
cd extension
pnpm build          # outputs to extension/dist
```

## Install in Chrome

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. **Load unpacked** → select `extension/dist`

## Use

1. Open any article, click the Simple Reader icon → **Read this page**
2. First run downloads the voice model (~63 MB, cached in OPFS after that)
3. Popup shows generation progress; playback starts as soon as the first
   sentence is ready. Play/pause and skip between sentences from the popup.

Generated sentence audio is cached (Cache API) for 6 hours, so replaying a page
doesn't regenerate it.

## How it works

- `popup` — controls + progress UI
- `content script` — extracts sentences from the live DOM (reuses the app's
  sentence splitter from `lib/utils/split-sentences.ts`) and highlights the
  active one via `CSS.highlights`
- `offscreen document` — runs Piper (piper-tts-web, WASM) and plays the audio,
  so playback survives popup close / tab switch
- `background` — wiring between the three
