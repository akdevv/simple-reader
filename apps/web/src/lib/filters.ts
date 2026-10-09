// URL filters + snippet escaping for search. No DB, so it's unit-testable.

export interface Filters {
  q: string;
  category: string;
  tag: string;
  site: string;
  /** todo = not finished yet */
  status: "todo" | "done" | "all";
  sort: "relevance" | "newest" | "oldest";
}

export function parseFilters(params: URLSearchParams): Filters {
  const get = (k: string) => params.get(k)?.trim().slice(0, 200) ?? "";
  const q = get("q");
  const sort = get("sort");
  return {
    q,
    category: get("category"),
    tag: get("tag"),
    site: get("site"),
    status: ["done", "all"].includes(get("status"))
      ? (get("status") as "done" | "all")
      : "todo",
    sort:
      sort === "newest" || sort === "oldest" || sort === "relevance"
        ? sort
        : q
          ? "relevance"
          : "newest",
  };
}

// ts_headline marks matches with these; we escape everything else, then swap them for <mark>
export const START = "\u0001";
export const STOP = "\u0002";

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Safe HTML: escaped snippet text with <mark> around the matched words. */
export function snippetHtml(raw: string): string {
  return escapeHtml(raw)
    .replaceAll(START, "<mark>")
    .replaceAll(STOP, "</mark>");
}
