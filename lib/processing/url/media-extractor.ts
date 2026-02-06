/**
 * Extracts media (images, videos) from the full page HTML that Readability
 * may have dropped, and collects final media items from sections.
 */

import { JSDOM } from "jsdom";
import type { ArticleSection, MediaItem } from "@/lib/types/article";
import {
  resolveUrl,
  getImageUrl,
  parseSrcset,
  detectVideoProvider,
  getEmbedUrl,
} from "./text-extractor";
import { isContentImage, isInHead, isSvgImageUrl } from "./media-rules";

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
export function extractMediaFromFullPage(
  document: Document,
  baseUrl: string,
  existingUrls: Set<string>
): { leadImage: ArticleSection | null; extraSections: ArticleSection[] } {
  let leadImage: ArticleSection | null = null;
  const extraSections: ArticleSection[] = [];

  // URLs of images used in <link rel="preload" as="image"> — drop these as content
  const preloadImageUrls = new Set<string>();
  document.querySelectorAll('link[rel="preload"][as="image"]').forEach((link) => {
    const href = link.getAttribute("href");
    if (href) preloadImageUrls.add(resolveUrl(href.trim(), baseUrl));
  });

  // --- OG / meta tags ---

  // 1. OG image / twitter:image — usually the hero/lead image
  const ogImage =
    document.querySelector('meta[property="og:image"]')?.getAttribute("content") ||
    document.querySelector('meta[name="twitter:image"]')?.getAttribute("content") ||
    document.querySelector('meta[property="og:image:url"]')?.getAttribute("content");

  if (ogImage) {
    const resolved = resolveUrl(ogImage.trim(), baseUrl);
    if (
      !existingUrls.has(resolved) &&
      !preloadImageUrls.has(resolved) &&
      !isSvgImageUrl(resolved)
    ) {
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
    if (isInHead(document, img)) return;
    const imgUrl = getImageUrl(img, baseUrl);
    if (!imgUrl) return;
    if (existingUrls.has(imgUrl)) return;
    if (preloadImageUrls.has(imgUrl)) return;
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
    if (isInHead(document, picture)) return;
    const innerImg = picture.querySelector("img");
    if (innerImg) {
      const imgUrl = getImageUrl(innerImg, baseUrl);
      if (
        imgUrl &&
        !existingUrls.has(imgUrl) &&
        !preloadImageUrls.has(imgUrl) &&
        isContentImage(innerImg, imgUrl)
      ) {
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
        if (
          parsed &&
          !existingUrls.has(parsed) &&
          !preloadImageUrls.has(parsed) &&
          !isSvgImageUrl(parsed)
        ) {
          existingUrls.add(parsed);
          extraSections.push({ type: "image", url: parsed });
        }
      }
    }
  });

  // 5. Scan <video> elements Readability may have stripped
  document.querySelectorAll("video").forEach((video) => {
    if (isInHead(document, video)) return;
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
    if (isInHead(document, iframe)) return;
    const src =
      iframe.getAttribute("src") ||
      iframe.getAttribute("data-src") ||
      iframe.getAttribute("data-lazy-src");
    if (!src) return;

    const provider = detectVideoProvider(src);
    if (provider === "raw") return;

    const embedUrl = getEmbedUrl(src);
    if (existingUrls.has(embedUrl)) return;

    existingUrls.add(embedUrl);
    existingUrls.add(src);
    extraSections.push({ type: "video", url: embedUrl, provider });
  });

  // 7. Scan <noscript> blocks for hidden images/videos
  document.querySelectorAll("noscript").forEach((noscript) => {
    if (isInHead(document, noscript)) return;
    const inner = noscript.textContent || "";
    if (!inner.includes("<img") && !inner.includes("<video") && !inner.includes("<iframe")) return;
    const noscriptDom = new JSDOM(`<body>${inner}</body>`);
    const noscriptBody = noscriptDom.window.document.body;

    noscriptBody.querySelectorAll("img").forEach((img) => {
      const imgUrl = getImageUrl(img, baseUrl);
      if (
        imgUrl &&
        !existingUrls.has(imgUrl) &&
        !preloadImageUrls.has(imgUrl) &&
        isContentImage(img, imgUrl)
      ) {
        existingUrls.add(imgUrl);
        extraSections.push({
          type: "image",
          url: imgUrl,
          alt: img.getAttribute("alt") || undefined,
        });
      }
    });

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

export function extractMedia(sections: ArticleSection[]): MediaItem[] {
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
