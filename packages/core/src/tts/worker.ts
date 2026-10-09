// Web Worker entry: Piper inference, off the main thread so playback and
// highlighting never block while a sentence generates.
import { TtsSession } from "@mintplex-labs/piper-tts-web";
import * as ort from "onnxruntime-web";

// Multi-threaded ort spawns blob: workers, which the extension CSP blocks.
// piper-tts-web sets numThreads to hardwareConcurrency during init, so pin it.
Object.defineProperty(ort.env.wasm, "numThreads", {
  get: () => 1,
  set: () => {},
});

export type WorkerIn =
  | { type: "init"; voiceId: string; assetBase: string }
  | { type: "predict"; id: number; text: string };

export type WorkerOut =
  | { type: "progress"; pct: number }
  | { type: "ready" }
  | { type: "result"; id: number; buf: ArrayBuffer }
  /** id -1 = init failed */
  | { type: "error"; id: number; message: string };

let session: TtsSession | null = null;

const post = (msg: WorkerOut, transfer: Transferable[] = []) =>
  self.postMessage(msg, { transfer });

self.onmessage = async (e: MessageEvent<WorkerIn>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      session = await TtsSession.create({
        voiceId: msg.voiceId,
        // Everything loads from our own origin, never a CDN (the extension
        // CSP blocks remote code). The voice model itself comes from
        // HuggingFace once and is cached in OPFS by the lib.
        wasmPaths: {
          onnxWasm: msg.assetBase,
          piperData: `${msg.assetBase}piper_phonemize.data`,
          piperWasm: `${msg.assetBase}piper_phonemize.wasm`,
        },
        progress: (p) => {
          if (p.url.endsWith(".onnx") && p.total > 0) {
            post({
              type: "progress",
              pct: Math.round((p.loaded / p.total) * 100),
            });
          }
        },
      });
      post({ type: "ready" });
    } else {
      if (!session) throw new Error("TTS session not initialized");
      const wav = await session.predict(msg.text);
      const buf = await wav.arrayBuffer();
      post({ type: "result", id: msg.id, buf }, [buf]);
    }
  } catch (err) {
    post({
      type: "error",
      id: msg.type === "predict" ? msg.id : -1,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
