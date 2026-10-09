import { IDLE_STATE, type ReaderState, type Speed } from "../types";
import type { WorkerIn, WorkerOut } from "./worker";

export interface Player {
  /** New text to read. Does not start audio; toggle() or seek() does. */
  load(sentences: string[], startAt?: number): void;
  toggle(): void;
  next(): void;
  prev(): void;
  /** Jump to a sentence and play it, even when paused. */
  seek(index: number): void;
  stop(): void;
  setSpeed(speed: Speed): void;
  /** Called now and on every state change. Returns an unsubscribe function. */
  subscribe(listener: (state: ReaderState) => void): () => void;
}

export interface PlayerOptions {
  /** URL prefix (ending in "/") serving the files from ttsAssets() */
  assetBase: string;
}

// Medium voices only: piper-tts-web's phonemizer emits ids from the full symbol
// table, which "low" models (smaller table) reject on some words, e.g. "wasn't".
const VOICE = "en_US-hfc_female-medium";
const CACHE_NAME = "sr-tts";
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
// sentences generated ahead of the one playing
const AHEAD = 6;

/* ---------- wav cache (Cache API) ---------- */
// Every cache call is best-effort: a missing/blocked cache only costs regeneration.

async function cacheKey(text: string): Promise<string> {
  const data = new TextEncoder().encode(`${VOICE}|${text}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hex = Array.from(new Uint8Array(hash), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
  return `https://tts.cache/${hex}`;
}

async function cacheGet(key: string): Promise<Blob | null> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const res = await cache.match(key);
    if (!res) return null;
    if (Date.now() - Number(res.headers.get("x-created-at")) > CACHE_TTL_MS) {
      await cache.delete(key);
      return null;
    }
    return await res.blob();
  } catch {
    return null;
  }
}

async function cachePut(key: string, wav: Blob): Promise<void> {
  try {
    const cache = await caches.open(CACHE_NAME);
    await cache.put(
      key,
      new Response(wav, {
        headers: {
          "content-type": "audio/wav",
          "x-created-at": `${Date.now()}`,
        },
      }),
    );
  } catch {
    // ignore
  }
}

async function purgeExpired(): Promise<void> {
  const cache = await caches.open(CACHE_NAME);
  for (const req of await cache.keys()) {
    const res = await cache.match(req);
    if (Date.now() - Number(res?.headers.get("x-created-at")) > CACHE_TTL_MS)
      await cache.delete(req);
  }
}

/* ---------- player ---------- */

export function createPlayer({ assetBase }: PlayerOptions): Player {
  let state: ReaderState = { ...IDLE_STATE };
  const listeners = new Set<(s: ReaderState) => void>();
  let texts: string[] = [];
  /** object URL per sentence: null = not generated yet, "" = generation failed */
  let urls: (string | null)[] = [];
  /** Bumped on load/stop so stale async work drops its results. */
  let session = 0;
  let speed: Speed = 1;
  const audio = new Audio();

  function emit(patch: Partial<ReaderState>): void {
    state = { ...state, ...patch };
    for (const l of listeners) l(state);
  }

  /* ----- worker ----- */

  let worker: Worker | null = null;
  let ready: Promise<void> | null = null;
  let predictId = 0;
  const pending = new Map<number, (wav: Blob | null) => void>();

  function loadModel(): Promise<void> {
    if (ready) return ready;
    worker ??= new Worker(new URL("./worker.ts", import.meta.url), {
      type: "module",
    });
    const w = worker;
    ready = new Promise((resolve, reject) => {
      w.onmessage = (e: MessageEvent<WorkerOut>) => {
        const msg = e.data;
        if (msg.type === "progress") emit({ modelProgress: msg.pct });
        else if (msg.type === "ready") resolve();
        else if (msg.type === "result") {
          pending.get(msg.id)?.(new Blob([msg.buf], { type: "audio/wav" }));
          pending.delete(msg.id);
        } else if (msg.id === -1) {
          ready = null; // allow a retry
          reject(new Error(msg.message));
        } else {
          console.error("[sr] tts:", msg.message);
          pending.get(msg.id)?.(null);
          pending.delete(msg.id);
        }
      };
    });
    w.postMessage({
      type: "init",
      voiceId: VOICE,
      assetBase,
    } satisfies WorkerIn);
    return ready;
  }

  function predict(text: string): Promise<Blob | null> {
    const id = ++predictId;
    return new Promise((resolve) => {
      pending.set(id, resolve);
      worker!.postMessage({ type: "predict", id, text } satisfies WorkerIn);
    });
  }

  /* ----- generation: always the next missing sentence near the current one ----- */

  let generating = false;
  let wake: (() => void) | null = null;

  function nextMissing(): number {
    const from = Math.max(state.index, 0);
    for (let i = from; i < Math.min(urls.length, from + AHEAD); i++) {
      if (urls[i] === null) return i;
    }
    return -1;
  }

  // One long-lived loop; it sleeps when nothing near the current sentence is missing.
  async function generateLoop(): Promise<void> {
    if (generating) return;
    generating = true;
    try {
      await loadModel();
      if (state.phase === "loading-model") emit({ phase: "generating" });
      for (;;) {
        const i = nextMissing();
        if (i === -1) {
          await new Promise<void>((r) => (wake = r));
          continue;
        }
        const my = session;
        const text = texts[i]!;
        const key = await cacheKey(text);
        let wav = await cacheGet(key);
        if (!wav) {
          wav = await predict(text);
          if (wav) void cachePut(key, wav);
        }
        if (my !== session) continue; // loaded/stopped meanwhile
        urls[i] = wav ? URL.createObjectURL(wav) : "";
        emit({ generated: urls.filter((u) => u !== null).length });
        // the sentence we were waiting on is ready
        if (i === state.index && state.phase === "generating") play(i);
      }
    } catch (err) {
      emit({
        phase: "error",
        error: err instanceof Error ? err.message : "TTS failed",
      });
    } finally {
      generating = false;
    }
  }

  function kick(): void {
    wake?.();
    wake = null;
    void generateLoop();
  }

  /* ----- playback ----- */

  function play(index: number): void {
    if (index < 0 || index >= urls.length) return;
    const url = urls[index];
    if (url === "") {
      // generation failed: skip it
      if (index + 1 < urls.length) play(index + 1);
      else emit({ phase: "done", index: -1 });
      return;
    }
    if (url === null || url === undefined) {
      audio.pause();
      emit({ index, phase: ready ? "generating" : "loading-model" });
      kick();
      return;
    }
    audio.src = url;
    // a new src resets playbackRate to defaultPlaybackRate: set both
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
    audio.play().catch((err) => console.error("[sr] play:", err));
    emit({ index, phase: "playing" });
    kick(); // keep generating ahead of the new position
  }

  audio.addEventListener("ended", () => {
    if (state.phase !== "playing") return;
    if (state.index + 1 >= urls.length) emit({ phase: "done", index: -1 });
    else play(state.index + 1);
  });

  function reset(): void {
    session++;
    audio.pause();
    audio.removeAttribute("src");
    urls.forEach((u) => u && URL.revokeObjectURL(u));
    urls = [];
    texts = [];
  }

  purgeExpired().catch(() => {});

  return {
    load(sentences, startAt = 0) {
      reset();
      texts = sentences;
      urls = sentences.map(() => null);
      const index = Math.min(Math.max(startAt, 0), sentences.length - 1);
      state = {
        ...IDLE_STATE,
        total: sentences.length,
        index,
        phase: "paused",
      };
      emit({});
    },
    toggle() {
      switch (state.phase) {
        case "playing":
          audio.pause();
          emit({ phase: "paused" });
          break;
        case "generating":
        case "loading-model":
          emit({ phase: "paused" });
          break;
        case "paused":
          if (audio.src && urls[state.index] === audio.src) {
            audio.play().catch(() => {});
            emit({ phase: "playing" });
          } else play(state.index);
          break;
        case "done":
        case "error":
          play(0);
          break;
      }
    },
    next() {
      if (state.index < urls.length - 1) play(state.index + 1);
    },
    prev() {
      play(Math.max(0, state.index - 1));
    },
    seek(index) {
      play(index);
    },
    stop() {
      reset();
      state = { ...IDLE_STATE };
      emit({});
    },
    setSpeed(next) {
      speed = next;
      audio.defaultPlaybackRate = next;
      audio.playbackRate = next;
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(state);
      return () => listeners.delete(listener);
    },
  };
}
