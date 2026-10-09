import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  boolean,
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  vector,
} from "drizzle-orm/pg-core";

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

const timestamps = {
  createdAt: timestamp().notNull().defaultNow(),
  updatedAt: timestamp()
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/* ---------- Better Auth (core schema) ---------- */

export const user = pgTable("user", {
  id: text().primaryKey(),
  name: text().notNull(),
  email: text().notNull().unique(),
  emailVerified: boolean().notNull().default(false),
  image: text(),
  ...timestamps,
});

export const session = pgTable("session", {
  id: text().primaryKey(),
  expiresAt: timestamp().notNull(),
  token: text().notNull().unique(),
  ipAddress: text(),
  userAgent: text(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const account = pgTable("account", {
  id: text().primaryKey(),
  accountId: text().notNull(),
  providerId: text().notNull(),
  userId: text()
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text(),
  refreshToken: text(),
  idToken: text(),
  accessTokenExpiresAt: timestamp(),
  refreshTokenExpiresAt: timestamp(),
  scope: text(),
  password: text(),
  ...timestamps,
});

export const verification = pgTable("verification", {
  id: text().primaryKey(),
  identifier: text().notNull(),
  value: text().notNull(),
  expiresAt: timestamp().notNull(),
  ...timestamps,
});

/** Better Auth rate limiter, in the DB so limits hold across serverless instances */
export const rateLimit = pgTable("rate_limit", {
  id: text().primaryKey(),
  key: text().notNull().unique(),
  count: integer().notNull(),
  lastRequest: bigint({ mode: "number" }).notNull(),
});

/* ---------- app ---------- */

export const DEFAULT_CATEGORIES = [
  "Tech",
  "Science",
  "Business",
  "Culture",
  "Politics",
  "Health",
  "Design",
  "Other",
];

export const category = pgTable(
  "category",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text().notNull(),
  },
  (t) => [unique().on(t.userId, t.name)],
);

export const article = pgTable(
  "article",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    url: text().notNull(),
    title: text().notNull(),
    byline: text(),
    siteName: text(),
    excerpt: text(),
    publishedAt: timestamp(),
    /** sanitized */
    contentHtml: text().notNull(),
    contentText: text().notNull(),
    wordCount: integer().notNull(),
    categoryId: uuid().references(() => category.id, { onDelete: "set null" }),
    categorySource: text().$type<"auto" | "manual">().notNull().default("auto"),
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'`),
    /** sentence index to resume from */
    position: integer().notNull().default(0),
    status: text()
      .$type<"unread" | "reading" | "done">()
      .notNull()
      .default("unread"),
    source: text().$type<"web" | "extension">().notNull().default("web"),
    ...timestamps,
    // ponytail: tsvector caps at 1MB, so only the first 500k chars of the body are indexed
    search: tsvector().generatedAlwaysAs(
      (): SQL =>
        sql`setweight(to_tsvector('english', ${article.title}), 'A') || setweight(to_tsvector('english', coalesce(${article.siteName}, '') || ' ' || coalesce(${article.byline}, '')), 'B') || setweight(to_tsvector('english', left(${article.contentText}, 500000)), 'C')`,
    ),
    /** null until computed (phase 7) */
    embedding: vector({ dimensions: 384 }),
  },
  (t) => [
    unique().on(t.userId, t.url),
    index().using("gin", t.search),
    index().using("gin", t.tags),
    index().using("hnsw", t.embedding.op("vector_cosine_ops")),
  ],
);

export const highlight = pgTable(
  "highlight",
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    articleId: uuid()
      .notNull()
      .references(() => article.id, { onDelete: "cascade" }),
    /** char offsets into the rendered article text */
    start: integer("start_offset").notNull(),
    end: integer("end_offset").notNull(),
    quote: text().notNull(),
    note: text(),
    ...timestamps,
    search: tsvector().generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('english', ${highlight.quote} || ' ' || coalesce(${highlight.note}, ''))`,
    ),
  },
  (t) => [index().using("gin", t.search)],
);
