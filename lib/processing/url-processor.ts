import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import type { ArticleSection, MediaItem } from "@/lib/types/article";
import type { ProcessingResult } from "@/lib/types/processing";

// Only match elements that are clearly popups/modals via ARIA attributes
const POPUP_SELECTORS_SAFE = [
  '[role="dialog"]',
  '[aria-modal="true"]',
];

// Class/id patterns that indicate popup-like elements.
// Matched as whole "words" within the class/id string to avoid
// nuking things like "hero-overlay" or "modal-content".
const POPUP_CLASS_PATTERNS = [
  /\bcookie[-_]?banner\b/i,
  /\bcookie[-_]?consent\b/i,
  /\bconsent[-_]?modal\b/i,
  /\bconsent[-_]?banner\b/i,
  /\bcookie[-_]?notice\b/i,
  /\bgdpr\b/i,
  /\bpopup[-_]?overlay\b/i,
  /\bmodal[-_]?overlay\b/i,
  /\bpaywall[-_]?modal\b/i,
  /\bsubscribe[-_]?wall\b/i,
  /\blogin[-_]?wall\b/i,
  /\bgate[-_]?modal\b/i,
];

function cleanPopups(document: Document): number {
  let removedCount = 0;

  // Remove elements matching safe ARIA selectors
  for (const selector of POPUP_SELECTORS_SAFE) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.remove();
        removedCount++;
      });
    } catch {
      // Invalid selector, skip
    }
  }

  // Remove elements whose class or id matches popup patterns
  const allElements = document.querySelectorAll("*");
  allElements.forEach((el) => {
    const cls = el.getAttribute("class") || "";
    const id = el.getAttribute("id") || "";
    const combined = `${cls} ${id}`;

    for (const pattern of POPUP_CLASS_PATTERNS) {
      if (pattern.test(combined)) {
        el.remove();
        removedCount++;
        return; // element already removed, skip other patterns
      }
    }
  });

  // Remove position:fixed elements with high z-index
  document.querySelectorAll("*").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") || "";
    if (
      /position\s*:\s*fixed/i.test(style) &&
      /z-index\s*:\s*(\d+)/i.test(style)
    ) {
      const zMatch = style.match(/z-index\s*:\s*(\d+)/i);
      if (zMatch && parseInt(zMatch[1], 10) > 999) {
        el.remove();
        removedCount++;
      }
    }
  });

  // Remove scroll locks from body/html
  const body = document.querySelector("body");
  const html = document.querySelector("html");
  for (const el of [body, html]) {
    if (el) {
      const style = el.getAttribute("style") || "";
      if (/overflow\s*:\s*hidden/i.test(style)) {
        el.setAttribute(
          "style",
          style.replace(/overflow\s*:\s*hidden\s*;?/gi, "")
        );
      }
    }
  }

  // Strip blur / max-height clipping inline styles
  document.querySelectorAll("*").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") || "";
    if (/filter\s*:.*blur|max-height\s*:/i.test(style)) {
      const cleaned = style
        .replace(/filter\s*:[^;]*blur[^;]*;?/gi, "")
        .replace(/max-height\s*:[^;]*;?/gi, "")
        .trim();
      if (cleaned) {
        (el as HTMLElement).setAttribute("style", cleaned);
      } else {
        (el as HTMLElement).removeAttribute("style");
      }
    }
  });

  return removedCount;
}

function resolveUrl(src: string, baseUrl: string): string {
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}

/**
 * Extract the best image URL from an element by checking src, data-src,
 * data-lazy-src, srcset, data-srcset (common lazy-loading patterns).
 */
function getImageUrl(el: Element, baseUrl: string): string | null {
  // Prefer src, then data-src variants used by lazy loaders
  const candidates = [
    el.getAttribute("src"),
    el.getAttribute("data-src"),
    el.getAttribute("data-lazy-src"),
    el.getAttribute("data-original"),
  ];

  for (const src of candidates) {
    if (src && !src.startsWith("data:") && src.trim()) {
      return resolveUrl(src.trim(), baseUrl);
    }
  }

  // Fall back to srcset / data-srcset — pick the largest image
  const srcset = el.getAttribute("srcset") || el.getAttribute("data-srcset");
  if (srcset) {
    const parsed = parseSrcset(srcset, baseUrl);
    if (parsed) return parsed;
  }

  return null;
}

/**
 * Parse a srcset string and return the URL of the largest/best image.
 */
function parseSrcset(srcset: string, baseUrl: string): string | null {
  let bestUrl: string | null = null;
  let bestWidth = 0;

  for (const entry of srcset.split(",")) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length === 0) continue;
    const url = parts[0];
    if (!url || url.startsWith("data:")) continue;

    // Parse width descriptor like "800w" or density like "2x"
    const descriptor = parts[1] || "";
    const wMatch = descriptor.match(/^(\d+)w$/);
    const width = wMatch ? parseInt(wMatch[1], 10) : 1;

    if (width > bestWidth) {
      bestWidth = width;
      bestUrl = url;
    }
  }

  return bestUrl ? resolveUrl(bestUrl.trim(), baseUrl) : null;
}

function detectVideoProvider(
  url: string
): "youtube" | "vimeo" | "raw" {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return "raw";
}

function getEmbedUrl(url: string): string {
  // Convert YouTube watch URLs to embed URLs
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  // Convert Vimeo URLs to embed URLs
  const vimeoMatch = url.match(
    /(?:vimeo\.com\/)(\d+)/
  );
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return url;
}

function htmlToSections(
  html: string,
  baseUrl: string
): ArticleSection[] {
  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;
  const sections: ArticleSection[] = [];

  function walkNodes(parent: Element) {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === 3) {
        // Text node
        const text = (node.textContent || "").trim();
        if (text) {
          sections.push({ type: "paragraph", content: text });
        }
        continue;
      }

      if (node.nodeType !== 1) continue; // Skip non-element nodes
      const el = node as Element;
      const tag = el.tagName.toUpperCase();

      switch (tag) {
        case "H1":
        case "H2":
        case "H3":
        case "H4":
        case "H5":
        case "H6": {
          const text = (el.textContent || "").trim();
          if (text) {
            sections.push({
              type: "heading",
              level: parseInt(tag[1], 10) as 1 | 2 | 3 | 4 | 5 | 6,
              content: text,
            });
          }
          break;
        }

        case "P": {
          // Check for images inside paragraph
          const imgs = el.querySelectorAll("img");
          imgs.forEach((img) => {
            const imgUrl = getImageUrl(img, baseUrl);
            if (imgUrl) {
              sections.push({
                type: "image",
                url: imgUrl,
                alt: img.getAttribute("alt") || undefined,
              });
            }
          });

          const text = (el.textContent || "").trim();
          if (text) {
            sections.push({ type: "paragraph", content: text });
          }
          break;
        }

        case "IMG": {
          const imgUrl = getImageUrl(el, baseUrl);
          if (imgUrl) {
            sections.push({
              type: "image",
              url: imgUrl,
              alt: el.getAttribute("alt") || undefined,
            });
          }
          break;
        }

        case "PICTURE": {
          // <picture> contains <source> and <img> — extract from inner <img>
          // or fall back to <source> srcset
          const innerImg = el.querySelector("img");
          if (innerImg) {
            const imgUrl = getImageUrl(innerImg, baseUrl);
            if (imgUrl) {
              sections.push({
                type: "image",
                url: imgUrl,
                alt: innerImg.getAttribute("alt") || undefined,
              });
              break;
            }
          }
          // Fallback: try <source> srcset
          const source = el.querySelector("source");
          if (source) {
            const srcset = source.getAttribute("srcset");
            if (srcset) {
              const parsed = parseSrcset(srcset, baseUrl);
              if (parsed) {
                sections.push({ type: "image", url: parsed });
              }
            }
          }
          break;
        }

        case "FIGURE": {
          const figImg = el.querySelector("img");
          const picture = el.querySelector("picture");
          const figcaption = el.querySelector("figcaption");
          const captionText = figcaption?.textContent?.trim() || undefined;

          // Try <picture> first, then <img>
          const targetImg = picture?.querySelector("img") || figImg;
          if (targetImg) {
            const imgUrl = getImageUrl(targetImg, baseUrl);
            if (imgUrl) {
              sections.push({
                type: "image",
                url: imgUrl,
                alt: targetImg.getAttribute("alt") || undefined,
                caption: captionText,
              });
            }
          } else {
            // Figure without img, walk children
            walkNodes(el);
          }
          break;
        }

        case "IFRAME": {
          const src = el.getAttribute("src");
          if (src) {
            const provider = detectVideoProvider(src);
            if (provider !== "raw") {
              sections.push({
                type: "video",
                url: getEmbedUrl(src),
                provider,
              });
            }
          }
          break;
        }

        case "VIDEO": {
          const src =
            el.getAttribute("src") ||
            el.querySelector("source")?.getAttribute("src");
          if (src) {
            sections.push({
              type: "video",
              url: resolveUrl(src, baseUrl),
              provider: "raw",
            });
          }
          break;
        }

        case "BLOCKQUOTE": {
          const text = (el.textContent || "").trim();
          if (text) {
            sections.push({ type: "blockquote", content: text });
          }
          break;
        }

        case "PRE": {
          const code = el.querySelector("code");
          const text = (code || el).textContent || "";
          const lang =
            code?.getAttribute("class")?.match(/language-(\w+)/)?.[1] ||
            undefined;
          if (text.trim()) {
            sections.push({
              type: "code",
              content: text,
              language: lang,
            });
          }
          break;
        }

        case "UL":
        case "OL": {
          const items: string[] = [];
          el.querySelectorAll(":scope > li").forEach((li) => {
            const text = (li.textContent || "").trim();
            if (text) items.push(text);
          });
          if (items.length > 0) {
            sections.push({
              type: "list",
              ordered: tag === "OL",
              items,
            });
          }
          break;
        }

        case "DIV":
        case "SECTION":
        case "ARTICLE":
        case "MAIN":
        case "ASIDE":
        case "HEADER":
        case "FOOTER":
        case "SPAN":
          // Container elements: walk children
          walkNodes(el);
          break;

        default: {
          // For other elements, try to extract text
          const text = (el.textContent || "").trim();
          if (text && el.children.length === 0) {
            sections.push({ type: "paragraph", content: text });
          } else if (el.children.length > 0) {
            walkNodes(el);
          }
          break;
        }
      }
    }
  }

  walkNodes(body);

  // Global sweep: find any <img> in the HTML that the walk missed
  // (e.g. inside <noscript>, non-standard wrappers, or deeply nested)
  const existingImageUrls = new Set(
    sections.filter((s) => s.type === "image").map((s) => (s as { url: string }).url)
  );

  body.querySelectorAll("img").forEach((img) => {
    const imgUrl = getImageUrl(img, baseUrl);
    if (imgUrl && !existingImageUrls.has(imgUrl)) {
      existingImageUrls.add(imgUrl);
      sections.push({
        type: "image",
        url: imgUrl,
        alt: img.getAttribute("alt") || undefined,
      });
    }
  });

  // Also check <noscript> blocks — sites often hide the real <img> there
  body.querySelectorAll("noscript").forEach((noscript) => {
    const inner = noscript.textContent || "";
    const noscriptDom = new JSDOM(`<body>${inner}</body>`);
    noscriptDom.window.document.body.querySelectorAll("img").forEach((img) => {
      const imgUrl = getImageUrl(img, baseUrl);
      if (imgUrl && !existingImageUrls.has(imgUrl)) {
        existingImageUrls.add(imgUrl);
        sections.push({
          type: "image",
          url: imgUrl,
          alt: img.getAttribute("alt") || undefined,
        });
      }
    });
  });

  return sections;
}

/**
 * Minimum dimensions to consider an image "content" rather than a tracking
 * pixel, icon, or spacer. If an <img> has explicit width/height attributes
 * below these thresholds we skip it.
 */
const MIN_IMAGE_DIMENSION = 80;

/**
 * Patterns in image URLs that indicate non-content images (tracking pixels,
 * social icons, UI sprites, etc.)
 */
const JUNK_IMAGE_PATTERNS = [
  /\/tracking[/.-]/i,
  /\/pixel[/.-]/i,
  /\/beacon[/.-]/i,
  /\/analytics[/.-]/i,
  /\/ads[/.-]/i,
  /\/avatar[/.-]/i,
  /\/icon[/.-]/i,
  /\/logo[/.-]/i,
  /\/favicon/i,
  /\/badge[/.-]/i,
  /\/button[/.-]/i,
  /\/spinner[/.-]/i,
  /\/loading[/.-]/i,
  /1x1\./i,
  /spacer\./i,
  /blank\./i,
  /transparent\./i,
  /gravatar\.com/i,
];

function isContentImage(img: Element, imgUrl: string): boolean {
  // Skip tiny images (tracking pixels, spacers)
  const width = parseInt(img.getAttribute("width") || "0", 10);
  const height = parseInt(img.getAttribute("height") || "0", 10);
  if (width > 0 && width < MIN_IMAGE_DIMENSION) return false;
  if (height > 0 && height < MIN_IMAGE_DIMENSION) return false;

  // Skip images whose URLs match junk patterns
  for (const pattern of JUNK_IMAGE_PATTERNS) {
    if (pattern.test(imgUrl)) return false;
  }

  return true;
}

/**
 * Extract images, videos, and GIFs from the **original full-page HTML** that
 * Readability may have dropped. This catches:
 * - og:image / twitter:image meta tags (hero / lead image)
 * - og:video / twitter:player meta tags (embedded video)
 * - <img> tags (including GIFs) that are large enough to be content
 * - <video> and <iframe> (YouTube/Vimeo) elements Readability stripped
 * - <picture> elements and <noscript> fallbacks
 *
 * Already-extracted URLs (from Readability output) are skipped.
 */
function extractMediaFromFullPage(
  document: Document,
  baseUrl: string,
  existingUrls: Set<string>
): { leadImage: ArticleSection | null; extraSections: ArticleSection[] } {
  let leadImage: ArticleSection | null = null;
  const extraSections: ArticleSection[] = [];

  // --- OG / meta tags ---

  // 1. OG image / twitter:image — usually the hero/lead image
  const ogImage =
    document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
    document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:image:url"]')?.getAttribute("content");

  if (ogImage) {
    const resolved = resolveUrl(ogImage.trim(), baseUrl);
    if (!existingUrls.has(resolved)) {
      existingUrls.add(resolved);
      const ogAlt =
        document.querySelector('meta[property="og:image:alt"]')?.getAttribute("content") ||
        undefined;
      leadImage = { type: "image", url: resolved, alt: ogAlt };
    }
  }

  // 2. OG video / twitter:player — embedded video in meta tags
  const ogVideo =
    document.querySelector('meta[property="og:video"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:video:url"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:video:secure_url"]')?.getAttribute("content") ||
    document.querySelector('meta[name="twitter:player"]')?.getAttribute("content");

  if (ogVideo) {
    const resolved = resolveUrl(ogVideo.trim(), baseUrl);
    const provider = detectVideoProvider(resolved);
    if (!existingUrls.has(resolved) && !existingUrls.has(getEmbedUrl(resolved))) {
      const embedUrl = getEmbedUrl(resolved);
      existingUrls.add(embedUrl);
      existingUrls.add(resolved);
      extraSections.push({ type: "video", url: embedUrl, provider });
    }
  }

  // --- Full-page element scan ---

  // 3. Scan all <img> tags for content images (including GIFs)
  document.querySelectorAll("img").forEach((img) => {
    const imgUrl = getImageUrl(img, baseUrl);
    if (!imgUrl) return;
    if (existingUrls.has(imgUrl)) return;
    if (!isContentImage(img, imgUrl)) return;

    existingUrls.add(imgUrl);
    extraSections.push({
      type: "image",
      url: imgUrl,
      alt: img.getAttribute("alt") || undefined,
    });
  });

  // 4. Scan <picture> elements
  document.querySelectorAll("picture").forEach((picture) => {
    const innerImg = picture.querySelector("img");
    if (innerImg) {
      const imgUrl = getImageUrl(innerImg, baseUrl);
      if (imgUrl && !existingUrls.has(imgUrl) && isContentImage(innerImg, imgUrl)) {
        existingUrls.add(imgUrl);
        extraSections.push({
          type: "image",
          url: imgUrl,
          alt: innerImg.getAttribute("alt") || undefined,
        });
      }
      return;
    }
    // Fallback to <source> srcset
    const source = picture.querySelector("source");
    if (source) {
      const srcset = source.getAttribute("srcset");
      if (srcset) {
        const parsed = parseSrcset(srcset, baseUrl);
        if (parsed && !existingUrls.has(parsed)) {
          existingUrls.add(parsed);
          extraSections.push({ type: "image", url: parsed });
        }
      }
    }
  });

  // 5. Scan <video> elements Readability may have stripped
  document.querySelectorAll("video").forEach((video) => {
    const src =
      video.getAttribute("src") ||
      video.getAttribute("data-src") ||
      video.querySelector("source")?.getAttribute("src") ||
      video.querySelector("source")?.getAttribute("data-src");
    if (!src) return;
    const resolved = resolveUrl(src.trim(), baseUrl);
    if (existingUrls.has(resolved)) return;

    existingUrls.add(resolved);
    extraSections.push({
      type: "video",
      url: resolved,
      provider: detectVideoProvider(resolved),
    });
  });

  // 6. Scan <iframe> elements for YouTube/Vimeo embeds Readability dropped
  document.querySelectorAll("iframe").forEach((iframe) => {
    const src =
      iframe.getAttribute("src") ||
      iframe.getAttribute("data-src") ||
      iframe.getAttribute("data-lazy-src");
    if (!src) return;

    const provider = detectVideoProvider(src);
    if (provider === "raw") return; // Only care about known video providers

    const embedUrl = getEmbedUrl(src);
    if (existingUrls.has(embedUrl)) return;

    existingUrls.add(embedUrl);
    existingUrls.add(src);
    extraSections.push({ type: "video", url: embedUrl, provider });
  });

  // 7. Scan <noscript> blocks for hidden images/videos
  document.querySelectorAll("noscript").forEach((noscript) => {
    const inner = noscript.textContent || "";
    if (!inner.includes("<img") && !inner.includes("<video") && !inner.includes("<iframe")) return;
    const noscriptDom = new JSDOM(`<body>${inner}</body>`);
    const noscriptBody = noscriptDom.window.document.body;

    // Images in noscript
    noscriptBody.querySelectorAll("img").forEach((img) => {
      const imgUrl = getImageUrl(img, baseUrl);
      if (imgUrl && !existingUrls.has(imgUrl) && isContentImage(img, imgUrl)) {
        existingUrls.add(imgUrl);
        extraSections.push({
          type: "image",
          url: imgUrl,
          alt: img.getAttribute("alt") || undefined,
        });
      }
    });

    // Videos in noscript
    noscriptBody.querySelectorAll("video").forEach((video) => {
      const src = video.getAttribute("src") || video.querySelector("source")?.getAttribute("src");
      if (src) {
        const resolved = resolveUrl(src.trim(), baseUrl);
        if (!existingUrls.has(resolved)) {
          existingUrls.add(resolved);
          extraSections.push({ type: "video", url: resolved, provider: detectVideoProvider(resolved) });
        }
      }
    });

    // Iframes in noscript
    noscriptBody.querySelectorAll("iframe").forEach((iframe) => {
      const src = iframe.getAttribute("src");
      if (!src) return;
      const provider = detectVideoProvider(src);
      if (provider === "raw") return;
      const embedUrl = getEmbedUrl(src);
      if (!existingUrls.has(embedUrl)) {
        existingUrls.add(embedUrl);
        extraSections.push({ type: "video", url: embedUrl, provider });
      }
    });
  });

  const extraImageCount = extraSections.filter((s) => s.type === "image").length;
  const extraVideoCount = extraSections.filter((s) => s.type === "video").length;
  console.log(
    `[url-processor] Full-page media scan: lead=${leadImage ? 1 : 0}, images=${extraImageCount}, videos=${extraVideoCount}`
  );

  return { leadImage, extraSections };
}

function extractMedia(sections: ArticleSection[]): MediaItem[] {
  const media: MediaItem[] = [];
  const seen = new Set<string>();

  for (const section of sections) {
    if (section.type === "image" && !seen.has(section.url)) {
      seen.add(section.url);
      media.push({
        type: "image",
        url: section.url,
        alt: section.alt,
      });
    } else if (section.type === "video" && !seen.has(section.url)) {
      seen.add(section.url);
      media.push({
        type: "video",
        url: section.url,
        provider: section.provider,
      });
    }
  }

  return media;
}

export async function processUrl(url: string): Promise<ProcessingResult> {
  console.log(`[url-processor] Starting extraction for: ${url}`);

  // Fetch the page
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15000),
    redirect: "follow",
  });

  if (!response.ok) {
    console.log(`[url-processor] Fetch failed: ${response.status} ${response.statusText}`);
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
