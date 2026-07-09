import type { Message, ReaderState } from "@/shared/messages";
import { IDLE_STATE } from "@/shared/messages";
import type { Settings } from "@/shared/settings";
import { DEFAULT_SETTINGS } from "@/shared/settings";

/**
 * Offscreen document: owns audio playback, caching and state, and delegates
 * Piper inference to a worker (tts-worker.ts) so this thread — playback,
 * highlight/state messaging — never blocks while a sentence generates.
 */

// ponytail: "low" = 16 kHz = fastest inference; en_US-hfc_female-medium if quality matters more
const VOICE = "en_US-amy-low";
const CACHE_NAME = "simple-reader-tts";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // keep generated audio for 6 hours

let settings: Settings = { ...DEFAULT_SETTINGS };
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

/* ---------- tts (inference lives in tts-worker.ts) ---------- */

const worker = new Worker(new URL("./tts-worker.ts", import.meta.url), {
  type: "module",
});
let workerReady: Promise<void> | null = null;
let resolveReady: (() => void) | null = null;
let rejectReady: ((err: Error) => void) | null = null;
let predictId = 0;
const pendingPredictions = new Map<
  number,
  { resolve: (wav: Blob) => void; reject: (err: Error) => void }
>();

worker.onmessage = (e) => {
  const msg = e.data;
  switch (msg.type) {
    case "progress":
      broadcast({ modelProgress: msg.pct });
      break;
    case "ready":
      resolveReady?.();
      break;
    case "result": {
      const pending = pendingPredictions.get(msg.id);
      pendingPredictions.delete(msg.id);
      pending?.resolve(new Blob([msg.buf], { type: "audio/wav" }));
      break;
    }
    case "error": {
      const err = new Error(msg.message);
      if (msg.id === -1) {
        rejectReady?.(err);
        workerReady = null; // allow a retry
      } else {
        const pending = pendingPredictions.get(msg.id);
        pendingPredictions.delete(msg.id);
        pending?.reject(err);
      }
      break;
    }
  }
};

async function loadModel(): Promise<void> {
  if (!workerReady) {
    broadcast({ phase: "loading-model", modelProgress: 0 });
    workerReady = new Promise<void>((resolve, reject) => {
      resolveReady = resolve;
      rejectReady = reject;
    });
    worker.postMessage({
      type: "init",
      voiceId: VOICE,
      // Everything loads from the extension bundle, never from a CDN
      // (remote scripts are blocked by the extension CSP). The voice model
      // itself is fetched from HuggingFace once and cached in OPFS by the lib.
      wasmPaths: {
        onnxWasm: chrome.runtime.getURL("ort/"),
        piperData: chrome.runtime.getURL("piper/piper_phonemize.data"),
        piperWasm: chrome.runtime.getURL("piper/piper_phonemize.wasm"),
      },
    });
  }
  return workerReady;
}

function predict(text: string): Promise<Blob> {
  const id = ++predictId;
  return new Promise((resolve, reject) => {
    pendingPredictions.set(id, { resolve, reject });
    worker.postMessage({ type: "predict", id, text });
  });
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

  await loadModel();
  if (mySession !== session) return;
  broadcast({ phase: "generating" });

  for (let i = 0; i < texts.length; i++) {
    if (mySession !== session) return;

    const key = await cacheKey(texts[i]);
    let wav = await cacheGet(key);
    if (!wav) {
      try {
        wav = await predict(texts[i]);
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
  // loading a new src resets playbackRate to defaultPlaybackRate — set both
  audio.defaultPlaybackRate = settings.speed;
  audio.playbackRate = settings.speed;
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

chrome.runtime.onMessage.addListener((msg: Message, _sender, sendResponse) => {
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
    // Sentence clicked on the page — jump there and play (even if paused,
    // clicking a sentence is an unambiguous "read this now").
    case "sr:seek":
      if (state.phase === "playing" || state.phase === "paused" || state.phase === "generating" || state.phase === "done") {
        playSentence(msg.index);
      }
      break;
    case "sr:get-state":
      sendResponse(state);
      break;
    case "sr:settings":
      applySettings(msg.settings);
      break;
  }
});

function applySettings(next: Settings): void {
  settings = next;
  audio.defaultPlaybackRate = next.speed;
  audio.playbackRate = next.speed;
}

// Pull stored settings once on startup; live changes arrive from the popup.
chrome.runtime
  .sendMessage({ type: "sr:get-settings" } satisfies Message)
  .then((stored?: Settings) => {
    if (stored) applySettings(stored);
  })
  .catch(() => {});

purgeExpired().catch(() => {});
