/**
 * Converts Readability HTML output into ArticleSection[].
 * Also exports shared URL/HTML helpers used by media-extractor.
 */

import { JSDOM } from "jsdom";
import type { ArticleSection } from "@/lib/types/article";
import {
  isBoilerplateElement,
  isRelatedContentSection,
  hasProtectedContent,
  stripUiChrome,
} from "./text-rules";

// --- Shared helpers (also used by media-extractor) ---

export function resolveUrl(src: string, baseUrl: string): string {
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
export function getImageUrl(el: Element, baseUrl: string): string | null {
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
export function parseSrcset(srcset: string, baseUrl: string): string | null {
  let bestUrl: string | null = null;
  let bestWidth = 0;

  for (const entry of srcset.split(",")) {
    const parts = entry.trim().split(/\s+/);
    if (parts.length === 0) continue;
    const url = parts[0];
    if (!url || url.startsWith("data:")) continue;

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

export function detectVideoProvider(
  url: string
): "youtube" | "vimeo" | "raw" {
  if (/youtube\.com|youtu\.be/i.test(url)) return "youtube";
  if (/vimeo\.com/i.test(url)) return "vimeo";
  return "raw";
}

export function getEmbedUrl(url: string): string {
  const ytMatch = url.match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  if (ytMatch) {
    return `https://www.youtube.com/embed/${ytMatch[1]}`;
  }

  const vimeoMatch = url.match(/(?:vimeo\.com\/)(\d+)/);
  if (vimeoMatch) {
    return `https://player.vimeo.com/video/${vimeoMatch[1]}`;
  }

  return url;
}

/**
 * Serialize an element's inline content, preserving links as markdown-style
 * `[text](href)` so the UI can render them as clickable anchors.
 * Everything else is flattened to plain text.
 */
export function inlineHtml(el: Element, baseUrl?: string): string {
  let out = "";
  for (const node of Array.from(el.childNodes)) {
    if (node.nodeType === 3) {
      out += node.textContent || "";
    } else if (node.nodeType === 1) {
      const child = node as Element;
      if (child.tagName === "A") {
        const href = child.getAttribute("href");
        const text = (child.textContent || "").trim();
        if (href && text) {
          const resolved = baseUrl ? resolveUrl(href, baseUrl) : href;
          out += `[${text}](${resolved})`;
        } else {
          out += text;
        }
      } else {
        out += inlineHtml(child, baseUrl);
      }
    }
  }
  return out.trim();
}

// --- HTML to sections conversion ---

export function htmlToSections(
  html: string,
  baseUrl: string
): ArticleSection[] {
  const dom = new JSDOM(`<body>${html}</body>`);
  const body = dom.window.document.body;
  const sections: ArticleSection[] = [];

  function walkNodes(parent: Element) {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === 3) {
        const text = (node.textContent || "").trim();
        if (text) {
          sections.push({ type: "paragraph", content: text });
        }
        continue;
      }

      if (node.nodeType !== 1) continue;
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

          const text = inlineHtml(el, baseUrl);
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
          stripUiChrome(el);
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

        case "CODE":
        case "KBD": {
          const text = (el.textContent || "").trim();
          if (text) {
            sections.push({ type: "code", content: text });
          }
          break;
        }

        case "UL":
        case "OL": {
          const items: string[] = [];
          el.querySelectorAll(":scope > li").forEach((li) => {
            const text = inlineHtml(li, baseUrl);
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

        case "TABLE": {
          const caption = el.querySelector("caption")?.textContent?.trim() || undefined;
          const headers: string[] = [];
          const rows: string[][] = [];

          const thead = el.querySelector("thead");
          if (thead) {
            thead.querySelectorAll("th").forEach((th) => {
              headers.push(inlineHtml(th, baseUrl));
            });
          }

          if (headers.length === 0) {
            const firstRow = el.querySelector("tr");
            if (firstRow) {
              const ths = firstRow.querySelectorAll("th");
              if (ths.length > 0) {
                ths.forEach((th) => headers.push(inlineHtml(th, baseUrl)));
              }
            }
          }

          const tbody = el.querySelector("tbody") || el;
          tbody.querySelectorAll("tr").forEach((tr) => {
            const cells: string[] = [];
            const tds = tr.querySelectorAll("td");
            if (tds.length === 0) return;
            tds.forEach((td) => cells.push(inlineHtml(td, baseUrl)));
            if (cells.some((c) => c.trim())) {
              rows.push(cells);
            }
          });

          if (rows.length > 0) {
            sections.push({
              type: "table",
              headers,
              rows,
              caption,
            });
          }
          break;
        }

        // UI chrome — drop entirely
        case "BUTTON":
        case "SVG":
        case "CANVAS":
        case "INPUT":
        case "SELECT":
        case "TEXTAREA":
        case "FORM":
        case "LABEL":
          break;

        // Boilerplate containers — skip unless they have protected content
        case "HEADER":
        case "FOOTER":
        case "NAV":
        case "ASIDE": {
          if (isBoilerplateElement(el)) break;
          stripUiChrome(el);
          walkNodes(el);
          break;
        }

        // Content containers — check for "related articles" before recursing
        case "DIV":
        case "SECTION":
        case "ARTICLE":
        case "MAIN": {
          if (isRelatedContentSection(el)) break;
          // If container has protected content, strip chrome and walk
          if (hasProtectedContent(el)) {
            stripUiChrome(el);
          }
          walkNodes(el);
          break;
        }

        case "SPAN": {
          // Icon + text pattern: if span has an SVG/img sibling but also text, keep only text
          stripUiChrome(el);
          const text = (el.textContent || "").trim();
          if (text) {
            walkNodes(el);
          }
          break;
        }

        default: {
          const text = (el.textContent || "").trim();
          if (text && el.children.length === 0) {
            sections.push({ type: "paragraph", content: text });
          } else if (el.children.length > 0) {
            if (!isRelatedContentSection(el)) {
              walkNodes(el);
            }
          }
          break;
        }
      }
    }
  }

  walkNodes(body);

  // Global sweep: find any <img> in the HTML that the walk missed
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

  // Also check <noscript> blocks
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
