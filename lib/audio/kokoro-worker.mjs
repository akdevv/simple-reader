/**
 * Kokoro TTS worker — runs as a standalone Node.js process to avoid
 * Next.js Turbopack's __dirname rewriting which breaks kokoro-js voice loading.
 *
 * Input (stdin JSON): { sentences: Sentence[], articleId: string, voice: string, speed: number, model: string, dtype: string }
 * Output (stdout JSON): { audioUrl, sentences, alignments, totalDuration }
 */

import { KokoroTTS } from "kokoro-js";
import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

const SAMPLE_RATE = 24000;

function encodeWav(samples) {
  const dataSize = samples.length * 4;
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(3, 20); // IEEE float
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(SAMPLE_RATE, 24);
  header.writeUInt32LE(SAMPLE_RATE * 4, 28);
  header.writeUInt16LE(4, 32);
  header.writeUInt16LE(32, 34);
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  const data = Buffer.from(samples.buffer, samples.byteOffset, samples.byteLength);
  return Buffer.concat([header, data]);
}

// Read all stdin
const chunks = [];
for await (const chunk of process.stdin) {
  chunks.push(chunk);
}
const input = JSON.parse(Buffer.concat(chunks).toString("utf-8"));

const { sentences, articleId, voice, speed, model, dtype } = input;

// Load model
console.error(`[kokoro-worker] Loading model ${model} (dtype: ${dtype})...`);
const tts = await KokoroTTS.from_pretrained(model, { dtype, device: "cpu" });
console.error(`[kokoro-worker] Model loaded`);

const publicDir = join(process.cwd(), "public", "audio", articleId);
const outputPath = join(publicDir, "audio.wav");
await mkdir(publicDir, { recursive: true });

const audioChunks = [];
const alignments = [];
let totalSamples = 0;

console.error(`[kokoro-worker] Generating ${sentences.length} sentences, voice: ${voice}`);

for (let i = 0; i < sentences.length; i++) {
  const sentence = sentences[i];
  const startTime = totalSamples / SAMPLE_RATE;

  if (!sentence.text.trim()) {
    alignments.push({
      sentenceId: sentence.id,
      startTime: Math.round(startTime * 100) / 100,
      endTime: Math.round(startTime * 100) / 100,
    });
    continue;
  }

  try {
    const audio = await tts.generate(sentence.text, { voice, speed });
    audioChunks.push(audio.audio);
    totalSamples += audio.audio.length;

    const endTime = totalSamples / SAMPLE_RATE;
    alignments.push({
      sentenceId: sentence.id,
      startTime: Math.round(startTime * 100) / 100,
      endTime: Math.round(endTime * 100) / 100,
    });
  } catch (err) {
    console.error(`[kokoro-worker] Failed sentence ${i}: ${err.message}`);
    const silent = new Float32Array(Math.ceil(SAMPLE_RATE * 0.1));
    audioChunks.push(silent);
    totalSamples += silent.length;

    const endTime = totalSamples / SAMPLE_RATE;
    alignments.push({
      sentenceId: sentence.id,
      startTime: Math.round(startTime * 100) / 100,
      endTime: Math.round(endTime * 100) / 100,
    });
  }

  // Emit structured progress for parent process to capture
  console.error(JSON.stringify({ type: "progress", current: i + 1, total: sentences.length }));
}

// Merge + write WAV
const combined = new Float32Array(totalSamples);
let offset = 0;
for (const chunk of audioChunks) {
  combined.set(chunk, offset);
  offset += chunk.length;
}

await writeFile(outputPath, encodeWav(combined));

const totalDuration = Math.round((totalSamples / SAMPLE_RATE) * 100) / 100;
console.error(`[kokoro-worker] Done: ${sentences.length} sentences, ${totalDuration}s`);

// Output result as JSON to stdout
process.stdout.write(JSON.stringify({
  audioUrl: `/api/audio/${articleId}/audio.wav`,
  sentences,
  alignments,
  totalDuration,
}));
