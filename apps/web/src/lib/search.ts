import { and, asc, desc, eq, inArray, ne, sql, type SQL } from "drizzle-orm";
import { db } from "@/db";
import { article, category } from "@/db/schema";
import { embed, toVector } from "./embed";
import { START, STOP, type Filters } from "./filters";

const LIMIT = 100;
/** candidates taken from each ranking before fusing */
const POOL = 50;
/** reciprocal rank fusion constant (the usual 60) */
const RRF_K = 60;
// ponytail: cosine distance cut-off so unrelated articles don't fill the
// list for every query; tuned on a handful of articles, revisit with more data
const MAX_DISTANCE = 0.8;
// article↔article: related pairs measured ≤0.75, unrelated ≥0.8
const RELATED_MAX_DISTANCE = 0.78;

/**
 * One search box, two rankings: Postgres full-text (exact words/phrases win)
 * and pgvector similarity (meaning), merged by reciprocal rank fusion.
 * Filters apply to both. Embedding failures fall back to full-text only.
 */
// ponytail: first 100 results, no pagination; add a cursor when someone's archive outgrows it
export async function searchArticles(userId: string, f: Filters) {
  const tsq = sql`websearch_to_tsquery('english', ${f.q})`;
  const filters: SQL[] = [eq(article.userId, userId)];
  if (f.status === "done") filters.push(eq(article.status, "done"));
  if (f.status === "todo") filters.push(ne(article.status, "done"));
  if (f.category)
    filters.push(
      sql`${article.categoryId} in (select ${category.id} from ${category} where ${category.userId} = ${userId} and ${category.name} = ${f.category})`,
    );
  if (f.tag) filters.push(sql`${article.tags} @> array[${f.tag}]::text[]`);
  if (f.site) filters.push(eq(article.siteName, f.site));
  const where = and(...filters)!;

  let scores: Map<string, number> | null = null;
  if (f.q) {
    const qv = await embed([f.q])
      .then(([v]) => toVector(v!))
      .catch((err) => {
        console.error("[sr] query embedding failed:", err);
        return null;
      });
    const distance = qv ? sql`${article.embedding} <=> ${qv}::vector` : null;
    const rows = await db.execute<{ id: string; score: number }>(sql`
      with fts as (
        select ${article.id} as id, row_number() over (order by ts_rank(${article.search}, ${tsq}) desc) as r
        from ${article} where ${where} and ${article.search} @@ ${tsq}
        order by r limit ${POOL}
      )${
        distance
          ? sql`, vec as (
        select ${article.id} as id, row_number() over (order by ${distance}) as r
        from ${article} where ${where} and ${article.embedding} is not null and ${distance} < ${MAX_DISTANCE}
        order by r limit ${POOL}
      )`
          : sql``
      }
      select id, sum(1.0 / (${RRF_K} + r))::float as score
      from (select id, r from fts${distance ? sql` union all select id, r from vec` : sql``}) as hits
      group by id order by score desc limit ${LIMIT}`);
    scores = new Map(rows.map((r) => [r.id, r.score]));
    if (!scores.size) return [];
  }

  const results = await db
    .select({
      id: article.id,
      title: article.title,
      siteName: article.siteName,
      excerpt: article.excerpt,
      wordCount: article.wordCount,
      status: article.status,
      tags: article.tags,
      category: category.name,
      createdAt: article.createdAt,
      // only full-text hits have words to highlight; meaning-only hits show the excerpt
      snippet: f.q
        ? sql<
            string | null
          >`case when ${article.search} @@ ${tsq} then ts_headline('english', ${article.contentText}, ${tsq}, ${`StartSel=${START},StopSel=${STOP},MaxFragments=1,MaxWords=30,MinWords=15`}) end`
        : sql<null>`null`,
    })
    .from(article)
    .leftJoin(category, eq(article.categoryId, category.id))
    .where(scores ? inArray(article.id, [...scores.keys()]) : where)
    .orderBy(
      f.sort === "oldest" ? asc(article.createdAt) : desc(article.createdAt),
    )
    .limit(LIMIT);

  if (scores && f.sort === "relevance")
    results.sort((a, b) => scores.get(b.id)! - scores.get(a.id)!);
  return results;
}

/** Up to 5 articles close in meaning to this one. */
export async function relatedArticles(userId: string, articleId: string) {
  const target = sql`(select ${article.embedding} from ${article} where ${article.id} = ${articleId})`;
  return db
    .select({
      id: article.id,
      title: article.title,
      siteName: article.siteName,
    })
    .from(article)
    .where(
      and(
        eq(article.userId, userId),
        ne(article.id, articleId),
        sql`${article.embedding} is not null`,
        sql`${target} is not null`,
        sql`${article.embedding} <=> ${target} < ${RELATED_MAX_DISTANCE}`,
      ),
    )
    .orderBy(sql`${article.embedding} <=> ${target}`)
    .limit(5);
}

/** Distinct site names, for the filter dropdown. */
export async function userSites(userId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ site: article.siteName })
    .from(article)
    .where(
      and(eq(article.userId, userId), sql`${article.siteName} is not null`),
    )
    .orderBy(article.siteName);
  return rows.map((r) => r.site!);
}
