// Local sentence embeddings (all-MiniLM-L6-v2, 384 dims): free, no API key.
// No Astro imports, so scripts/backfill-embeddings.ts can use it too.
import {
  env,
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

export const DIMENSIONS = 384;

// Vercel's filesystem is read-only except /tmp.
// ponytail: each fresh instance downloads the 23MB model from Hugging Face
// (~3.5s once). Bundle it with includeFiles if cold starts or HF outages hurt.
if (process.env.VERCEL) env.cacheDir = "/tmp/hf";

let extractor: Promise<FeatureExtractionPipeline> | null = null;

export async function embed(texts: string[]): Promise<number[][]> {
  extractor ??= pipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2", {
    dtype: "q8",
  }).catch((err) => {
    extractor = null; // retry on the next call
    throw err;
  });
  const out = await (
    await extractor
  )(texts, {
    pooling: "mean",
    normalize: true,
  });
  return out.tolist() as number[][];
}

/** One vector per article: title + excerpt + opening text (the model reads ~256 tokens anyway). */
export function articleEmbeddingText(a: {
  title: string;
  excerpt: string | null;
  contentText: string;
}): string {
  return [a.title, a.excerpt ?? "", a.contentText.slice(0, 1500)].join("\n");
}

/** pgvector literal for a query parameter: '[0.1,0.2,...]' */
export const toVector = (v: number[]) => JSON.stringify(v);
