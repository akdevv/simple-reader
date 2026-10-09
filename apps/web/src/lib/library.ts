import { GEMINI_API_KEY, GEMINI_MODEL } from "astro:env/server";
import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { article, category } from "@/db/schema";
import { articleEmbeddingText, embed } from "./embed";
import { suggest } from "./suggest";

export const userCategories = (userId: string) =>
  db
    .select({ id: category.id, name: category.name })
    .from(category)
    .where(eq(category.userId, userId))
    .orderBy(category.name);

/** Every tag the user has used, most used first. */
export async function userTags(userId: string): Promise<string[]> {
  const rows = await db.execute<{ tag: string }>(
    sql`select tag from ${article}, unnest(${article.tags}) as tag
        where ${article.userId} = ${userId}
        group by tag order by count(*) desc, tag`,
  );
  return rows.map((r) => r.tag);
}

/** The user's "Other" category, recreated if they somehow lost it. */
async function otherCategory(userId: string): Promise<string> {
  const [row] = await db
    .insert(category)
    .values({ userId, name: "Other" })
    .onConflictDoUpdate({
      target: [category.userId, category.name],
      set: { name: "Other" },
    })
    .returning({ id: category.id });
  return row!.id;
}

/**
 * Ask Gemini for a category (+ tags when withTags). Only touches articles still
 * on categorySource 'auto'; a manual choice always wins. Never throws: no key,
 * a 429 or any failure leaves the article in "Other".
 */
export async function categorizeArticle(
  articleId: string,
  { withTags = false } = {},
): Promise<void> {
  try {
    const [a] = await db
      .select()
      .from(article)
      .where(eq(article.id, articleId));
    if (!a || a.categorySource !== "auto") return;
    const cats = await userCategories(a.userId);

    let result: { category: string; tags: string[] } | null = null;
    if (GEMINI_API_KEY) {
      try {
        result = await suggest(
          { ...a, text: a.contentText },
          cats.map((c) => c.name),
          (await userTags(a.userId)).slice(0, 100),
          {
            apiKey: GEMINI_API_KEY,
            model: GEMINI_MODEL || "gemini-3.5-flash-lite",
          },
        );
      } catch (err) {
        console.error("[sr] categorize:", err);
      }
    }

    const categoryId =
      cats.find((c) => c.name === result?.category)?.id ??
      (await otherCategory(a.userId));
    const tags =
      withTags && result ? [...new Set([...a.tags, ...result.tags])] : a.tags;
    await db
      .update(article)
      .set({ categoryId, tags })
      .where(
        and(eq(article.id, articleId), eq(article.categorySource, "auto")),
      );
  } catch (err) {
    console.error("[sr] categorize failed:", err);
  }
}

/** Compute the article's vector. Never throws: a failure leaves it null for the backfill script. */
export async function embedArticle(articleId: string): Promise<void> {
  try {
    const [a] = await db
      .select({
        title: article.title,
        excerpt: article.excerpt,
        contentText: article.contentText,
      })
      .from(article)
      .where(eq(article.id, articleId));
    if (!a) return;
    const [embedding] = await embed([articleEmbeddingText(a)]);
    await db
      .update(article)
      .set({ embedding })
      .where(eq(article.id, articleId));
  } catch (err) {
    console.error("[sr] embed failed:", err);
  }
}

/* ---------- tags ---------- */

/** Rename (or merge into an existing tag): array_replace, then dedupe. */
export async function renameTag(userId: string, from: string, to: string) {
  await db
    .update(article)
    .set({
      tags: sql`array(select distinct t from unnest(array_replace(${article.tags}, ${from}, ${to})) as t order by t)`,
    })
    .where(
      and(
        eq(article.userId, userId),
        sql`${article.tags} @> array[${from}]::text[]`,
      ),
    );
}

export async function deleteTag(userId: string, tag: string) {
  await db
    .update(article)
    .set({ tags: sql`array_remove(${article.tags}, ${tag})` })
    .where(
      and(
        eq(article.userId, userId),
        sql`${article.tags} @> array[${tag}]::text[]`,
      ),
    );
}

/* ---------- categories ---------- */

/** Rename; renaming onto an existing name merges the two. */
export async function renameCategory(userId: string, id: string, name: string) {
  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: category.id })
      .from(category)
      .where(
        and(
          eq(category.userId, userId),
          eq(category.name, name),
          ne(category.id, id),
        ),
      );
    if (target) {
      await tx
        .update(article)
        .set({ categoryId: target.id })
        .where(and(eq(article.userId, userId), eq(article.categoryId, id)));
      await tx
        .delete(category)
        .where(and(eq(category.id, id), eq(category.userId, userId)));
    } else {
      await tx
        .update(category)
        .set({ name })
        .where(and(eq(category.id, id), eq(category.userId, userId)));
    }
  });
}

/** Delete a category; its articles move to "Other" (which can't be deleted). */
export async function deleteCategory(userId: string, id: string) {
  const otherId = await otherCategory(userId);
  if (id === otherId) return;
  await db.transaction(async (tx) => {
    await tx
      .update(article)
      .set({ categoryId: otherId })
      .where(and(eq(article.userId, userId), eq(article.categoryId, id)));
    await tx
      .delete(category)
      .where(and(eq(category.id, id), eq(category.userId, userId)));
  });
}
