/**
 * URL processing pipeline entry point.
 * Fetches a URL, cleans popups, runs Readability, extracts sections and media.
 */

import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { ProcessingResult } from "@/lib/types/processing";
import { cleanPopups } from "./text-rules";
import { htmlToSections } from "./text-extractor";
import { extractMediaFromFullPage, extractMedia } from "./media-extractor";

export async function processUrl(
  url: string
): Promise<ProcessingResult> {
  console.log(`[url-processor] Starting extraction for: ${url}`);

  // Fetch the page
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });

  if (!response.ok) {
    console.log(
      `[url-processor] Fetch failed: ${response.status} ${response.statusText}`
    );
    throw new Error(
      `Failed to fetch article: ${response.status} ${response.statusText}`
    );
  }

  const html = await response.text();
  console.log(`[url-processor] Fetched HTML: ${html.length} chars`);

  // Try 1: clean popups then run Readability
  const dom = new JSDOM(html, { url });
  const document = dom.window.document;

  const popupsRemoved = cleanPopups(document);
  console.log(`[url-processor] Popups/overlays removed: ${popupsRemoved}`);

  const reader = new Readability(document);
  let article = reader.parse();

  // Try 2: if cleanup broke extraction, retry on the raw HTML
  if (!article) {
    console.log("[url-processor] Readability returned null after cleanup — retrying on raw HTML");
    const domRetry = new JSDOM(html, { url });
    const readerRetry = new Readability(domRetry.window.document);
    article = readerRetry.parse();
  }

  if (!article) {
    console.log("[url-processor] Readability returned null on both attempts — no article found");
    return {
      title: "",
      excerpt: "",
      siteName: null,
      sections: [],
      media: [],
      isPaywalled: true,
      errorMessage:
        "Could not extract article content. The page may be paywalled or not an article.",
    };
  }

  console.log(`[url-processor] Readability parsed — title: "${article.title}"`);
  console.log(`[url-processor] textContent length: ${(article.textContent || "").trim().length}`);
  console.log(`[url-processor] content HTML length: ${(article.content || "").length}`);

  // Check for hard paywall (very short content)
  const textLength = (article.textContent || "").trim().length;
  if (textLength < 200) {
    console.log(`[url-processor] Content too short (${textLength} chars) — likely paywalled`);
    return {
      title: article.title || "",
      excerpt: article.excerpt || "",
      siteName: article.siteName || new URL(url).hostname,
      sections: [],
      media: [],
      isPaywalled: true,
      errorMessage:
        "Article content is too short — it may be behind a paywall.",
    };
  }

  // Convert HTML content to sections
  const sections = htmlToSections(article.content || "", url);

  const readabilityImageCount = sections.filter((s) => s.type === "image").length;
  console.log(`[url-processor] Readability output: ${sections.length} sections (${readabilityImageCount} images)`);

  // Scan the ORIGINAL full-page HTML for media Readability may have missed
  const existingMediaUrls = new Set(
    sections
      .filter((s) => s.type === "image" || s.type === "video")
      .map((s) => (s as { url: string }).url)
  );
  const fullPageDom = new JSDOM(html, { url });
  const { leadImage, extraSections } = extractMediaFromFullPage(
    fullPageDom.window.document,
    url,
    existingMediaUrls
  );

  // Insert lead image (og:image) at the very top if we have one
  if (leadImage) {
    sections.unshift(leadImage);
  }

  // Append extra media found in the full page
  for (const section of extraSections) {
    sections.push(section);
  }

  const imageCount = sections.filter((s) => s.type === "image").length;
  const videoCount = sections.filter((s) => s.type === "video").length;
  const media = extractMedia(sections);
  console.log(`[url-processor] Final: ${sections.length} sections (${imageCount} images, ${videoCount} videos), ${media.length} media items`);

  // Extract excerpt from first paragraph if Readability didn't provide one
  let excerpt = article.excerpt || "";
  if (!excerpt) {
    const firstParagraph = sections.find((s) => s.type === "paragraph");
    if (firstParagraph && "content" in firstParagraph) {
      excerpt = firstParagraph.content.substring(0, 280);
    }
  }

  console.log(`[url-processor] Done — title: "${article.title}", sections: ${sections.length}, media: ${media.length}`);

  return {
    title: article.title || "",
    excerpt,
    siteName: article.siteName || new URL(url).hostname,
    sections,
    media,
    isPaywalled: false,
  };
}
