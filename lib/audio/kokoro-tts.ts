import { spawn } from "child_process";
import { join } from "path";
import { createInterface } from "readline";
import { Sentence, SentenceAlignment } from "@/lib/types/audio";

export interface TtsResult {
  audioUrl: string;
  sentences: Sentence[];
  alignments: SentenceAlignment[];
  totalDuration: number;
}

export interface TtsProgress {
  current: number;
  total: number;
}

const KOKORO_VOICE = process.env.KOKORO_VOICE || "af_heart";
const KOKORO_SPEED = parseFloat(process.env.KOKORO_SPEED || "1");
const KOKORO_MODEL =
  process.env.KOKORO_MODEL || "onnx-community/Kokoro-82M-v1.0-ONNX";
const KOKORO_DTYPE = process.env.KOKORO_DTYPE || "q8";

/**
 * Generate TTS audio by spawning a standalone Node.js worker process.
 *
 * We use a child process because Next.js Turbopack rewrites `__dirname` in
 * bundled server code, which breaks kokoro-js voice file resolution.
 * The worker script (`kokoro-worker.mjs`) runs as plain Node.js where
 * `__dirname` resolves correctly.
 */
export function generateTtsAudio(
  sentences: Sentence[],
  articleId: string,
  onProgress?: (progress: TtsProgress) => void,
): Promise<TtsResult> {
  return new Promise((resolve, reject) => {
    // Build path at runtime so the bundler doesn't try to resolve the .mjs file
    const workerFile = ["lib", "audio", "kokoro-worker.mjs"].join("/");
    const workerPath = join(process.cwd(), workerFile);

    const child = spawn(process.execPath, [workerPath], {
      cwd: process.cwd(),
      stdio: ["pipe", "pipe", "pipe"], // stdin, stdout, stderr all piped
    });

    const input = JSON.stringify({
      sentences,
      articleId,
      voice: KOKORO_VOICE,
      speed: KOKORO_SPEED,
      model: KOKORO_MODEL,
      dtype: KOKORO_DTYPE,
    });

    const stdoutChunks: Buffer[] = [];

    child.stdout.on("data", (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    // Parse stderr for structured progress JSON and forward other lines to console
    const rl = createInterface({ input: child.stderr! });
    rl.on("line", (line) => {
      try {
        const parsed = JSON.parse(line);
        if (parsed.type === "progress" && onProgress) {
          onProgress({ current: parsed.current, total: parsed.total });
        }
      } catch {
        // Not JSON — regular log line, forward to console
        console.error(line);
      }
    });

    child.on("close", (code) => {
      rl.close();
      if (code !== 0) {
        reject(new Error(`Kokoro worker exited with code ${code}`));
        return;
      }

      try {
        const output = Buffer.concat(stdoutChunks).toString("utf-8");
        resolve(JSON.parse(output));
      } catch (err) {
        reject(
          new Error(
            `Failed to parse kokoro worker output: ${err instanceof Error ? err.message : err}`,
          ),
        );
      }
    });

    child.on("error", (err) => {
      reject(new Error(`Failed to spawn kokoro worker: ${err.message}`));
    });

    child.stdin.write(input);
    child.stdin.end();
  });
}
