import { TtsSession } from "@mintplex-labs/piper-tts-web";
import * as ort from "onnxruntime-web";

/**
 * TTS inference worker. Piper runs here so the offscreen document's main
 * thread (audio playback + messaging) never blocks during generation.
 */

// Multi-threaded ort spawns blob: workers, which the extension CSP blocks.
// piper-tts-web sets numThreads to hardwareConcurrency during init, so pin it.
Object.defineProperty(ort.env.wasm, "numThreads", {
  get: () => 1,
  set: () => {},
});

type InMessage =
  | {
      type: "init";
      voiceId: string;
      wasmPaths: { onnxWasm: string; piperData: string; piperWasm: string };
    }
  | { type: "predict"; id: number; text: string };

let session: TtsSession | null = null;

self.onmessage = async (e: MessageEvent<InMessage>) => {
  const msg = e.data;
  try {
    if (msg.type === "init") {
      session = await TtsSession.create({
        voiceId: msg.voiceId,
        wasmPaths: msg.wasmPaths,
        progress: (p) => {
          if (p.url.endsWith(".onnx") && p.total > 0) {
            self.postMessage({
              type: "progress",
              pct: Math.round((p.loaded / p.total) * 100),
            });
          }
        },
      });
      self.postMessage({ type: "ready" });
    } else if (msg.type === "predict") {
      if (!session) throw new Error("TTS session not initialized");
      const wav = await session.predict(msg.text);
      const buf = await wav.arrayBuffer();
      self.postMessage({ type: "result", id: msg.id, buf }, { transfer: [buf] });
    }
  } catch (err) {
    self.postMessage({
      type: "error",
      id: msg.type === "predict" ? msg.id : -1,
      message: err instanceof Error ? err.message : String(err),
    });
  }
};
