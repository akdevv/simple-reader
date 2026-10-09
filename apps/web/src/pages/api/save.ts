import type { APIRoute } from "astro";

// TODO(phase 10): save an article sent by the extension.
export const POST: APIRoute = () =>
  Response.json({ error: "Not implemented yet" }, { status: 501 });
