import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import { parseHTML } from "linkedom";
import sanitizeHtml from "sanitize-html";

// Fetching + cleaning untrusted pages. No DB here, so it's unit-testable.

export class SaveError extends Error {}

const MAX_BYTES = 5 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 5;

/* ---------- fetching untrusted URLs (SSRF guard) ---------- */

const PRIVATE = new BlockList();
for (const [net, bits] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.168.0.0", 16],
  ["224.0.0.0", 3],
] as const)
  PRIVATE.addSubnet(net, bits, "ipv4");
for (const [net, bits] of [
  ["::", 127], // :: and ::1
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const)
  PRIVATE.addSubnet(net, bits, "ipv6");

async function assertPublic(url: URL): Promise<void> {
  if (url.protocol !== "http:" && url.protocol !== "https:")
    throw new SaveError("Only http and https links can be saved.");
  const host = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = isIP(host)
    ? [{ address: host, family: isIP(host) }]
    : await lookup(host, { all: true }).catch(() => {
        throw new SaveError("That site could not be found.");
      });
  for (const { address, family } of addresses) {
    // IPv4-mapped IPv6 (::ffff:10.0.0.1) is checked as IPv4
    const v4 = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
    if (
      v4
        ? PRIVATE.check(v4, "ipv4")
        : PRIVATE.check(address, family === 6 ? "ipv6" : "ipv4")
    )
      throw new SaveError("That address is not allowed.");
  }
}

/**
 * Fetch a page's HTML: http(s) only, public addresses only (checked on every
 * redirect hop), 10s timeout, 5MB cap, HTML content types only.
 */
// ponytail: fetch re-resolves DNS after our check, so DNS rebinding can slip
// through. Pin the resolved IP with an undici dispatcher if that ever matters.
export async function fetchPage(
  input: string,
): Promise<{ url: string; html: string }> {
  let url = new URL(input);
  const signal = AbortSignal.timeout(TIMEOUT_MS);
  try {
    for (let hop = 0; ; hop++) {
      await assertPublic(url);
      const res = await fetch(url, {
        redirect: "manual",
        signal,
        headers: {
          "user-agent":
            "Mozilla/5.0 (compatible; SimpleReader/1.0; +https://github.com/akdevv)",
          accept: "text/html,application/xhtml+xml",
        },
      });
      const location = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && location) {
        if (hop >= MAX_REDIRECTS) throw new SaveError("Too many redirects.");
        url = new URL(location, url);
        continue;
      }
      if (!res.ok)
        throw new SaveError(
          `The site answered ${res.status}. If it needs a login or blocks bots, use the browser extension's Save button.`,
        );
      const type = res.headers.get("content-type") ?? "";
      if (!/text\/html|application\/xhtml\+xml/.test(type))
        throw new SaveError("That link is not a web page.");
      if (Number(res.headers.get("content-length")) > MAX_BYTES)
        throw new SaveError("That page is too large.");

      // stream with a running cap: content-length can be missing or wrong
      const chunks: Uint8Array[] = [];
      let size = 0;
      for await (const chunk of res.body!) {
        size += chunk.byteLength;
        if (size > MAX_BYTES) throw new SaveError("That page is too large.");
        chunks.push(chunk);
      }
      const charset = type.match(/charset=([\w-]+)/i)?.[1] ?? "utf-8";
      let decoder: TextDecoder;
      try {
        decoder = new TextDecoder(charset);
      } catch {
        decoder = new TextDecoder();
      }
      return { url: url.href, html: decoder.decode(Buffer.concat(chunks)) };
    }
  } catch (err) {
    if (err instanceof SaveError) throw err;
    if (signal.aborted)
      throw new SaveError("The site took too long to answer.");
    throw new SaveError("Could not reach that site.");
  }
}

/* ---------- sanitize + store ---------- */

/** Extracted HTML is untrusted and renders on our origin: allowlist only. */
export function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      ...sanitizeHtml.defaults.allowedTags,
      "img",
      "h1",
      "h2",
      "figure",
      "figcaption",
    ],
    allowedAttributes: {
      // target/rel are always overwritten by transformTags below
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      td: ["colspan", "rowspan"],
      th: ["colspan", "rowspan"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedSchemesByTag: { img: ["http", "https"] },
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", {
        target: "_blank",
        rel: "noopener noreferrer nofollow",
      }),
    },
  });
}

/** Plain text of sanitized HTML, whitespace collapsed (search + AI input). */
export function htmlToText(html: string): string {
  // a space after each block, so "<p>a</p><p>b</p>" doesn't become "ab"
  const spaced = html.replace(
    /<\/(p|div|h[1-6]|li|blockquote|figcaption|pre|td|th|tr|dt|dd)>|<br\s*\/?>/gi,
    "$& ",
  );
  const { document } = parseHTML(`<html><body>${spaced}</body></html>`);
  return (document.body.textContent ?? "").replace(/\s+/g, " ").trim();
}

/** Normalize a pasted link so the same page dedupes: drop the #fragment. */
export function normalizeUrl(input: string): string {
  const url = new URL(input.trim());
  url.hash = "";
  return url.href;
}
