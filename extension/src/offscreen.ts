import { KokoroTTS } from "kokoro-js";
import { env } from "@huggingface/transformers";
import type { Message, ReaderState } from "./messages";
import { IDLE_STATE } from "./messages";

/**
 * Offscreen document: runs the Kokoro TTS model fully locally (WASM),
 * caches generated sentence audio for a few hours, and plays it back.
 * Broadcasts state so the popup (progress/controls) and the content
 * script (highlighting, via background relay) stay in sync.
 */

const MODEL = "onnx-community/Kokoro-82M-v1.0-ONNX";
const DTYPE = "q8"; // ponytail: quantized = the "faster model"; drop to q4 if wasm is too slow
const VOICE = "af_heart";
const CACHE_NAME = "simple-reader-tts";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // keep generated audio for 6 hours

// Load onnxruntime's wasm from the extension bundle, never from a CDN
// (remote scripts are blocked by the extension CSP).
env.backends.onnx.wasm!.wasmPaths = chrome.runtime.getURL("ort/");
// Multi-threaded ort spawns blob: workers, which the extension CSP blocks.
// ponytail: single thread; switch device to "webgpu" if wasm proves too slow
env.backends.onnx.wasm!.numThreads = 1;
env.allowLocalModels = false;

let tts: KokoroTTS | null = null;
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
  const data = new TextEncoder().encode(`${MODEL}|${VOICE}|${text}`);
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

/* ---------- wav encoding (float32 mono, same layout as kokoro-worker.mjs) ---------- */

function encodeWav(samples: Float32Array, sampleRate: number): Blob {
  const header = new DataView(new ArrayBuffer(44));
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) header.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, "RIFF");
  header.setUint32(4, 36 + samples.length * 4, true);
  writeStr(8, "WAVE");
  writeStr(12, "fmt ");
  header.setUint32(16, 16, true);
  header.setUint16(20, 3, true); // IEEE float
  header.setUint16(22, 1, true); // mono
  header.setUint32(24, sampleRate, true);
  header.setUint32(28, sampleRate * 4, true);
  header.setUint16(32, 4, true);
  header.setUint16(34, 32, true);
  writeStr(36, "data");
  header.setUint32(40, samples.length * 4, true);
  const data = new Uint8Array(
    samples.buffer as ArrayBuffer,
    samples.byteOffset,
    samples.byteLength,
  );
  return new Blob([header.buffer, data], { type: "audio/wav" });
}

/* ---------- tts ---------- */

async function loadModel(): Promise<KokoroTTS> {
  if (tts) return tts;
  broadcast({ phase: "loading-model", modelProgress: 0 });
  tts = await KokoroTTS.from_pretrained(MODEL, {
    dtype: DTYPE,
    device: "wasm",
    progress_callback: (p: { status: string; progress?: number }) => {
      if (p.status === "progress" && typeof p.progress === "number") {
        broadcast({ modelProgress: Math.round(p.progress) });
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
        const result = await model.generate(texts[i], { voice: VOICE });
        wav = encodeWav(result.audio as Float32Array, result.sampling_rate);
        await cachePut(key, wav);
      } catch (err) {
        console.error(`[simple-reader] sentence ${i} failed:`, err);
        wav = encodeWav(new Float32Array(2400), 24000); // 0.1s silence
      }
    }
    if (mySession !== session) return;

    audioUrls[i] = URL.createObjectURL(wav);
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
  if (!url) {
    // Not generated yet — mark position; onended/generation catches up below.
    broadcast({ phase: "playing", index });
    waitForSentence(index, mySession);
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
    if (audioUrls[index]) {
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
