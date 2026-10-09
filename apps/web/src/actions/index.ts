import {
  ActionError,
  defineAction,
  type ActionAPIContext,
} from "astro:actions";
import { z } from "astro/zod";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { article, category, highlight } from "@/db/schema";
import {
  categorizeArticle,
  deleteCategory,
  deleteTag,
  renameCategory,
  renameTag,
} from "@/lib/library";
import { SaveError, saveFromUrl } from "@/lib/save";
import { cleanTag } from "@/lib/suggest";

const MAX_BULK = 20;

function userId(ctx: ActionAPIContext): string {
  const id = ctx.locals.user?.id;
  if (!id) throw new ActionError({ code: "UNAUTHORIZED" });
  return id;
}

const ownArticle = (ctx: ActionAPIContext, id: string) =>
  and(eq(article.id, id), eq(article.userId, userId(ctx)));

const tagInput = z.string().transform((t, ctx) => {
  const tag = cleanTag(t);
  if (!tag) {
    ctx.addIssue({ code: "custom", message: "Tags are 1-40 characters." });
    return z.NEVER;
  }
  return tag;
});
const categoryName = z.string().trim().min(1).max(40);

export type SaveResult =
  | { url: string; status: "saved" | "duplicate"; id: string }
  | { url: string; status: "failed"; error: string };

export const server = {
  /** One or more links, one per line, processed in order. */
  saveArticles: defineAction({
    accept: "form",
    input: z.object({ urls: z.string().max(MAX_BULK * 2100) }),
    handler: async ({ urls }, ctx): Promise<SaveResult[]> => {
      const uid = userId(ctx);
      const list = [...new Set(urls.split(/\s+/).filter(Boolean))];
      if (!list.length)
        throw new ActionError({
          code: "BAD_REQUEST",
          message: "Paste at least one link.",
        });
      if (list.length > MAX_BULK)
        throw new ActionError({
          code: "BAD_REQUEST",
          message: `At most ${MAX_BULK} links at a time.`,
        });

      // ponytail: sequential, so 20 slow sites can take minutes; parallelize with a small pool if that hurts
      const results: SaveResult[] = [];
      for (const url of list) {
        try {
          const { id, duplicate } = await saveFromUrl(uid, url);
          results.push({ url, id, status: duplicate ? "duplicate" : "saved" });
        } catch (err) {
          if (!(err instanceof SaveError))
            console.error("[sr] save:", url, err);
          results.push({
            url,
            status: "failed",
            error:
              err instanceof SaveError ? err.message : "Something went wrong.",
          });
        }
      }
      return results;
    },
  }),

  setStatus: defineAction({
    accept: "form",
    input: z.object({
      id: z.uuid(),
      status: z.enum(["unread", "reading", "done"]),
    }),
    handler: async ({ id, status }, ctx) => {
      await db.update(article).set({ status }).where(ownArticle(ctx, id));
    },
  }),

  deleteArticle: defineAction({
    accept: "form",
    input: z.object({ id: z.uuid() }),
    handler: async ({ id }, ctx) => {
      await db.delete(article).where(ownArticle(ctx, id));
    },
  }),

  /** Called by the reader as sentences advance. */
  savePosition: defineAction({
    input: z.object({
      id: z.uuid(),
      position: z.int().min(0),
      done: z.boolean().optional(),
    }),
    handler: async ({ id, position, done }, ctx) => {
      await db
        .update(article)
        .set({ position, status: done ? "done" : "reading" })
        .where(ownArticle(ctx, id));
    },
  }),

  /* ----- per-article category + tags ----- */

  setCategory: defineAction({
    accept: "form",
    input: z.object({ id: z.uuid(), categoryId: z.uuid() }),
    handler: async ({ id, categoryId }, ctx) => {
      const [cat] = await db
        .select({ id: category.id })
        .from(category)
        .where(
          and(eq(category.id, categoryId), eq(category.userId, userId(ctx))),
        );
      if (!cat) throw new ActionError({ code: "NOT_FOUND" });
      await db
        .update(article)
        .set({ categoryId, categorySource: "manual" })
        .where(ownArticle(ctx, id));
    },
  }),

  /** Back to auto, then ask the AI again (awaited, so the page shows the result). */
  recategorize: defineAction({
    accept: "form",
    input: z.object({ id: z.uuid() }),
    handler: async ({ id }, ctx) => {
      await db
        .update(article)
        .set({ categorySource: "auto" })
        .where(ownArticle(ctx, id));
      await categorizeArticle(id);
    },
  }),

  addTag: defineAction({
    accept: "form",
    input: z.object({ id: z.uuid(), tag: tagInput }),
    handler: async ({ id, tag }, ctx) => {
      await db
        .update(article)
        .set({
          tags: sql`array_append(array_remove(${article.tags}, ${tag}), ${tag})`,
        })
        .where(ownArticle(ctx, id));
    },
  }),

  removeTag: defineAction({
    accept: "form",
    input: z.object({ id: z.uuid(), tag: z.string() }),
    handler: async ({ id, tag }, ctx) => {
      await db
        .update(article)
        .set({ tags: sql`array_remove(${article.tags}, ${tag})` })
        .where(ownArticle(ctx, id));
    },
  }),

  /* ----- highlights + notes (called from the reader) ----- */

  addHighlight: defineAction({
    input: z.object({
      articleId: z.uuid(),
      start: z.int().min(0),
      end: z.int().min(1),
      quote: z.string().min(1).max(5000),
      note: z.string().max(5000).optional(),
    }),
    handler: async (h, ctx) => {
      const [own] = await db
        .select({ id: article.id })
        .from(article)
        .where(ownArticle(ctx, h.articleId));
      if (!own) throw new ActionError({ code: "NOT_FOUND" });
      const [row] = await db
        .insert(highlight)
        .values({ ...h, note: h.note?.trim() || null, userId: userId(ctx) })
        .returning({ id: highlight.id });
      return row!;
    },
  }),

  updateNote: defineAction({
    input: z.object({ id: z.uuid(), note: z.string().max(5000) }),
    handler: async ({ id, note }, ctx) => {
      await db
        .update(highlight)
        .set({ note: note.trim() || null })
        .where(and(eq(highlight.id, id), eq(highlight.userId, userId(ctx))));
    },
  }),

  deleteHighlight: defineAction({
    input: z.object({ id: z.uuid() }),
    handler: async ({ id }, ctx) => {
      await db
        .delete(highlight)
        .where(and(eq(highlight.id, id), eq(highlight.userId, userId(ctx))));
    },
  }),

  /* ----- manage page ----- */

  renameTag: defineAction({
    accept: "form",
    input: z.object({ from: z.string(), to: tagInput }),
    handler: ({ from, to }, ctx) => renameTag(userId(ctx), from, to),
  }),

  deleteTag: defineAction({
    accept: "form",
    input: z.object({ tag: z.string() }),
    handler: ({ tag }, ctx) => deleteTag(userId(ctx), tag),
  }),

  addCategory: defineAction({
    accept: "form",
    input: z.object({ name: categoryName }),
    handler: async ({ name }, ctx) => {
      await db
        .insert(category)
        .values({ userId: userId(ctx), name })
        .onConflictDoNothing();
    },
  }),

  renameCategory: defineAction({
    accept: "form",
    input: z.object({ id: z.uuid(), name: categoryName }),
    handler: ({ id, name }, ctx) => renameCategory(userId(ctx), id, name),
  }),

  deleteCategory: defineAction({
    accept: "form",
    input: z.object({ id: z.uuid() }),
    handler: ({ id }, ctx) => deleteCategory(userId(ctx), id),
  }),
};
