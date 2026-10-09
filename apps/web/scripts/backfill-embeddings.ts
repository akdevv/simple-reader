// Fill in missing article embeddings: `pnpm db:backfill`
// (saves that failed to embed, or articles saved before semantic search).
import postgres from "postgres";
import { articleEmbeddingText, embed, toVector } from "../src/lib/embed.ts";

try {
  process.loadEnvFile();
} catch {
  // no .env: use the real environment
}
const sql = postgres(process.env.DATABASE_URL!, { prepare: false });

let done = 0;
for (;;) {
  const rows = await sql<
    { id: string; title: string; excerpt: string | null; contentText: string }[]
  >`select id, title, excerpt, content_text as "contentText"
    from article where embedding is null limit 32`;
  if (!rows.length) break;
  const vectors = await embed(rows.map(articleEmbeddingText));
  for (const [i, row] of rows.entries())
    await sql`update article set embedding = ${toVector(vectors[i]!)}::vector where id = ${row.id}`;
  done += rows.length;
  console.log(`embedded ${done}`);
}
console.log(done ? "done" : "nothing to backfill");
await sql.end();
