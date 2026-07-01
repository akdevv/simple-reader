import { TtsSession } from "@mintplex-labs/piper-tts-web";
import * as ort from "onnxruntime-web";
import type { Message, ReaderState } from "./messages";
import { IDLE_STATE } from "./messages";

/**
 * Offscreen document: runs the Piper TTS model fully locally (WASM),
 * caches generated sentence audio for a few hours, and plays it back.
 * Broadcasts state so the popup (progress/controls) and the content
 * script (highlighting, via background relay) stay in sync.
 */

// ponytail: "low" = 16 kHz = fastest inference; en_US-hfc_female-medium if quality matters more
const VOICE = "en_US-amy-low";
const CACHE_NAME = "simple-reader-tts";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // keep generated audio for 6 hours

// Multi-threaded ort spawns blob: workers, which the extension CSP blocks.
// piper-tts-web sets numThreads to hardwareConcurrency during init, so pin it.
Object.defineProperty(ort.env.wasm, "numThreads", {
  get: () => 1,
  set: () => {},
});

let tts: TtsSession | null = null;
let state: ReaderState = { ...IDLE_STATE };
/** Bump on every new page/stop so stale async loops abort. */
let session = 0;
let audioUrls: (string | null)[] = [];
const audio = new Audio();

function broadcast(patch: Partial<ReaderState>): void {
  state = { ...state, ...patch };
  chrome.runtime
    .sendMessage({ type: "sr:state", state } satisfies Message)
    .catch(() => {}); // no listeners open — fine
}

/* ---------- cache ---------- */

async function cacheKey(text: string): Promise<string> {
  const data = new TextEncoder().encode(`${VOICE}|${text}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `https://tts.cache/${hex}`;
}

async function cacheGet(key: string): Promise<Blob | null> {
  const cache = await caches.open(CACHE_NAME);
  const res = await cache.match(key);
  if (!res) return null;
  const ts = Number(res.headers.get("x-created-at") ?? 0);
  if (Date.now() - ts > CACHE_TTL_MS) {
    await cache.delete(key);
    return null;
  }
  return res.blob();
}

async function cachePut(key: string, wav: Blob): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  await cache.put(
    key,
    new Response(wav, {
      headers: { "content-type": "audio/wav", "x-created-at": `${Date.now()}` },
    }),
  );
}

async function purgeExpired(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    const ts = Number(res?.headers.get("x-created-at") ?? 0);
    if (Date.now() - ts > CACHE_TTL_MS) await cache.delete(req);
  }
}

/* ---------- tts ---------- */

async function loadModel(): Promise<TtsSession> {
  if (tts) return tts;
  broadcast({ phase: "loading-model", modelProgress: 0 });
  tts = await TtsSession.create({
    voiceId: VOICE,
    // Everything loads from the extension bundle, never from a CDN
    // (remote scripts are blocked by the extension CSP). The voice model
    // itself is fetched from HuggingFace once and cached in OPFS by the lib.
    wasmPaths: {
      onnxWasm: chrome.runtime.getURL("ort/"),
      piperData: chrome.runtime.getURL("piper/piper_phonemize.data"),
      piperWasm: chrome.runtime.getURL("piper/piper_phonemize.wasm"),
    },
    progress: (p) => {
      if (p.url.endsWith(".onnx") && p.total > 0) {
        broadcast({ modelProgress: Math.round((p.loaded / p.total) * 100) });
      }
    },
  });
  return tts;
}

async function generateAll(texts: string[]): Promise<void> {
  const mySession = ++session;
  stopPlayback();
  audioUrls.forEach((u) => u && URL.revokeObjectURL(u));
  audioUrls = new Array(texts.length).fill(null);
  state = { ...IDLE_STATE };
  broadcast({ phase: "loading-model", total: texts.length });

  if (texts.length === 0) {
    broadcast({ phase: "error", error: "No readable text found on this page." });
    return;
  }

  const model = await loadModel();
  if (mySession !== session) return;
  broadcast({ phase: "generating" });

  for (let i = 0; i < texts.length; i++) {
    if (mySession !== session) return;

    const key = await cacheKey(texts[i]);
    let wav = await cacheGet(key);
    if (!wav) {
      try {
        wav = await model.predict(texts[i]);
        await cachePut(key, wav);
      } catch (err) {
        console.error(`[simple-reader] sentence ${i} failed:`, err);
        wav = null; // skip this sentence rather than abort the page
      }
    }
    if (mySession !== session) return;

    // "" marks a failed sentence: playback skips it instead of waiting forever
    audioUrls[i] = wav ? URL.createObjectURL(wav) : "";
    broadcast({ generated: i + 1 });

    // Start playing as soon as the first sentence is ready.
    if (i === 0) playSentence(0, mySession);
  }
}

/* ---------- playback ---------- */

function playSentence(index: number, mySession = session): void {
  if (mySession !== session) return;
  if (index < 0 || index >= audioUrls.length) return;

  const url = audioUrls[index];
  if (url === null) {
    // Not generated yet — mark position; onended/generation catches up below.
    broadcast({ phase: "playing", index });
    waitForSentence(index, mySession);
    return;
  }
  if (url === "") {
    // Generation failed for this sentence — skip it.
    if (index + 1 >= audioUrls.length) {
      broadcast({ phase: "done", index: -1 });
    } else {
      playSentence(index + 1, mySession);
    }
    return;
  }
  audio.src = url;
  audio.play().catch((err) => console.error("[simple-reader] play:", err));
  broadcast({ phase: "playing", index });
}

/** Poll until a still-generating sentence becomes available, then play it. */
function waitForSentence(index: number, mySession: number): void {
  const timer = setInterval(() => {
    if (mySession !== session || state.phase !== "playing") {
      clearInterval(timer);
      return;
    }
    if (audioUrls[index] !== null) {
      clearInterval(timer);
      playSentence(index, mySession);
    }
  }, 200);
}

audio.addEventListener("ended", () => {
  if (state.phase !== "playing") return;
  const next = state.index + 1;
  if (next >= state.total) {
    broadcast({ phase: "done", index: -1 });
  } else {
    playSentence(next);
  }
});

function stopPlayback(): void {
  audio.pause();
  audio.removeAttribute("src");
}

function handleControl(action: "toggle" | "next" | "prev" | "stop"): void {
  switch (action) {
    case "toggle":
      if (state.phase === "playing") {
        audio.pause();
        broadcast({ phase: "paused" });
      } else if (state.phase === "paused") {
        if (audio.src) {
          audio.play().catch(() => {});
          broadcast({ phase: "playing" });
        } else {
          playSentence(state.index);
        }
      } else if (state.phase === "done") {
        playSentence(0);
      }
      break;
    case "next":
      if (state.index < state.total - 1) playSentence(state.index + 1);
      break;
    case "prev":
      playSentence(Math.max(0, state.index - 1));
      break;
    case "stop":
      session++;
      stopPlayback();
      broadcast({ ...IDLE_STATE });
      break;
  }
}

chrome.runtime.onMessage.addListener(
  (msg: Message, _sender, sendResponse) => {
    switch (msg.type) {
      case "sr:generate":
        generateAll(msg.texts).catch((err) => {
          console.error("[simple-reader] generation failed:", err);
          broadcast({
            phase: "error",
            error: err instanceof Error ? err.message : "TTS failed",
          });
        });
        break;
      case "sr:control":
        handleControl(msg.action);
        break;
      case "sr:get-state":
        sendResponse(state);
        break;
    }
  },
);

purgeExpired().catch(() => {});
