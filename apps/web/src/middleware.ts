import { defineMiddleware } from "astro:middleware";
import { auth } from "@/lib/auth";

export const onRequest = defineMiddleware(async (ctx, next) => {
  // prerendered pages have no request headers
  if (ctx.isPrerendered) return next();

  const session = await auth.api.getSession({ headers: ctx.request.headers });
  ctx.locals.user = session?.user ?? null;

  const { pathname } = ctx.url;
  if (!ctx.locals.user && (pathname === "/app" || pathname.startsWith("/app/")))
    return ctx.redirect(`/login?next=${encodeURIComponent(pathname)}`);
  if (ctx.locals.user && pathname === "/login") return ctx.redirect("/app");

  return next();
});
