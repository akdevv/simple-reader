import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import {
  BETTER_AUTH_SECRET,
  BETTER_AUTH_URL,
  GITHUB_CLIENT_ID,
  GITHUB_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
} from "astro:env/server";
import { db } from "@/db";
import * as schema from "@/db/schema";

const google =
  GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET
    ? { clientId: GOOGLE_CLIENT_ID, clientSecret: GOOGLE_CLIENT_SECRET }
    : undefined;
const github =
  GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET
    ? { clientId: GITHUB_CLIENT_ID, clientSecret: GITHUB_CLIENT_SECRET }
    : undefined;

/** Social providers with credentials set; the login page shows only these. */
export const socialProviders = [
  ...(google ? ["google" as const] : []),
  ...(github ? ["github" as const] : []),
];

export const auth = betterAuth({
  secret: BETTER_AUTH_SECRET,
  baseURL: BETTER_AUTH_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  // ponytail: no email verification or password reset (no email provider yet).
  // Add Resend + sendResetPassword when someone gets locked out.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
  },
  socialProviders: { google, github },
  // Per-IP limits, stored in Postgres so they hold across serverless instances.
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 100,
    customRules: {
      "/sign-in/*": { window: 60, max: 5 },
      "/sign-up/*": { window: 60 * 60, max: 3 },
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (u) => {
          await db
            .insert(schema.category)
            .values(
              schema.DEFAULT_CATEGORIES.map((name) => ({ userId: u.id, name })),
            );
        },
      },
    },
  },
});
