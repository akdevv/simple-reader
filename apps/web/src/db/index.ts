import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { DATABASE_URL } from "astro:env/server";
import * as schema from "./schema";

// postgres.js works against Neon and any other Postgres alike.
// prepare: false keeps it compatible with Neon's pooled (pgbouncer) URL.
export const db = drizzle(postgres(DATABASE_URL, { prepare: false }), {
  schema,
  casing: "snake_case",
});
