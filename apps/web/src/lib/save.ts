import { extract, type Article } from "@sr/core";
import { and, count, eq, gt } from "drizzle-orm";
import { waitUntil } from "@vercel/functions";
import { parseHTML } from "linkedom";
import { parse, serialize } from "parse5";
import { db } from "@/db";
import { categorizeArticle, embedArticle } from "./library";
import { article } from "@/db/schema";
import {
  fetchPage,
  htmlToText,
  normalizeUrl,
  sanitize,
  SaveError,
} from "./page";

export { SaveError };

/** saves per user per minute */
const SAVE_LIMIT = 20;

/** Too many saves in the last minute? Cheap guard against loops and abuse. */
export async function assertSaveQuota(userId: string): Promise<void> {
  const [row] = await db
    .select({ n: count() })
    .from(article)
    .where(
      and(
        eq(article.userId, userId),
        gt(article.createdAt, new Date(Date.now() - 60_000)),
      ),
    );
  if ((row?.n ?? 0) >= SAVE_LIMIT)
    throw new SaveError("Too many saves. Wait a minute and try again.");
}

/** Insert a (sanitized) article; an existing URL returns the existing row. */
export async function storeArticle(
  userId: string,
  a: Article,
  source: "web" | "extension",
): Promise<{ id: string; duplicate: boolean }> {
  const contentHtml = sanitize(a.html);
  const contentText = htmlToText(contentHtml);
  if (!contentText) throw new SaveError("No readable text found on that page.");
  const published = a.publishedAt ? new Date(a.publishedAt) : null;

  const [inserted] = await db
    .insert(article)
    .values({
      userId,
      url: a.url,
      title: a.title.slice(0, 500),
      byline: a.byline?.slice(0, 200),
      siteName: a.siteName?.slice(0, 200),
      excerpt: a.excerpt?.slice(0, 1000),
      publishedAt: published && !isNaN(+published) ? published : null,
      contentHtml,
      contentText,
      wordCount: contentText.split(" ").length,
      source,
    })
    .onConflictDoNothing({ target: [article.userId, article.url] })
    .returning({ id: article.id });
  if (inserted) {
    // after the response: the save never waits on (or fails because of) the AI
    waitUntil(
      Promise.all([
        categorizeArticle(inserted.id, { withTags: true }),
        embedArticle(inserted.id),
      ]),
    );
    return { id: inserted.id, duplicate: false };
  }

  const [existing] = await db
    .select({ id: article.id })
    .from(article)
    .where(and(eq(article.userId, userId), eq(article.url, a.url)));
  return { id: existing!.id, duplicate: true };
}

/** Full web pipeline: dedupe → fetch → extract → sanitize → insert. */
export async function saveFromUrl(
  userId: string,
  input: string,
): Promise<{ id: string; duplicate: boolean }> {
  let url: string;
  try {
    url = normalizeUrl(input);
  } catch {
    throw new SaveError("That doesn't look like a link.");
  }

  const [existing] = await db
    .select({ id: article.id })
    .from(article)
    .where(and(eq(article.userId, userId), eq(article.url, url)));
  if (existing) return { id: existing.id, duplicate: true };

  await assertSaveQuota(userId);
  const page = await fetchPage(url);
  // parse5 applies the HTML5 rules for omitted <head>/<body> tags, which
  // linkedom's parser doesn't; without this, such pages come out empty
  const { document } = parseHTML(serialize(parse(page.html)));
  // keep the URL the user pasted as the dedupe key, resolve links against the final one
  const extracted = extract(document as unknown as Document, page.url);
  if (!extracted) throw new SaveError("Couldn't find an article on that page.");
  return storeArticle(userId, { ...extracted, url }, "web");
}
