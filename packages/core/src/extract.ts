import { Readability } from "@mozilla/readability";
import type { Article } from "./types";

/**
 * Readability over any Document: the live page in the extension,
 * or a linkedom document on the server. Null when nothing article-like is found.
 */
export function extract(doc: Document, url: string): Article | null {
  // Readability mutates the document; never touch the live page.
  const clone = doc.cloneNode(true) as Document;

  // Absolutize links/images ourselves: linkedom has no baseURI, so
  // Readability would leave them relative to our origin.
  const base = doc.baseURI?.startsWith("http") ? doc.baseURI : url;
  for (const el of clone.querySelectorAll("[href], [src]")) {
    for (const attr of ["href", "src"]) {
      const value = el.getAttribute(attr);
      if (!value || value.startsWith("#")) continue;
      try {
        el.setAttribute(attr, new URL(value, base).href);
      } catch {
        // leave malformed URLs alone
      }
    }
  }

  let parsed: ReturnType<Readability<string>["parse"]>;
  try {
    parsed = new Readability(clone).parse();
  } catch {
    return null; // Readability throws on some malformed documents
  }
  const text = parsed?.textContent?.replace(/\s+/g, " ").trim();
  if (!parsed?.content || !text) return null;

  const siteName =
    parsed.siteName?.trim() || new URL(url).hostname.replace(/^www\./, "");
  // "Title | Site" → "Title" (Readability keeps short titles unsplit)
  const title = (parsed.title?.trim() ?? "")
    .replace(/\s+[|\-–—·]\s+(.+)$/, (m, site: string) =>
      site.toLowerCase() === siteName.toLowerCase() ? "" : m,
    )
    .trim();

  return {
    url,
    title: title || siteName,
    byline: parsed.byline?.trim() || null,
    siteName,
    excerpt: parsed.excerpt?.trim() || null,
    publishedAt: parsed.publishedTime || null,
    html: parsed.content,
    text,
  };
}
