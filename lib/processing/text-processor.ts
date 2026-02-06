import { marked } from "marked";
import type { ArticleSection, MediaItem, VideoMedia } from "@/lib/types/article";
import type { ProcessingResult } from "@/lib/types/processing";
import { detectCodeLanguage } from "./url/text-rules";

const IMAGE_URL_REGEX =
  /https?:\/\/\S+\.(?:jpg|jpeg|png|gif|webp|svg|avif)(?:\?\S*)?/gi;

const YOUTUBE_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/g;

const VIMEO_REGEX =
  /(?:https?:\/\/)?(?:www\.)?(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/g;

function detectFormat(content: string): "markdown" | "plain" {
  const mdPatterns = [
    /^#{1,6}\s/m, // headings
    /\*\*.+\*\*/, // bold
    /^[-*+]\s/m, // unordered lists
    /^\d+\.\s/m, // ordered lists
    /```[\s\S]*?```/, // code blocks
    /!\[.*?\]\(.*?\)/, // images
    /\[.*?\]\(.*?\)/, // links
    /^>\s/m, // blockquotes
  ];

  const matches = mdPatterns.filter((p) => p.test(content)).length;
  return matches >= 2 ? "markdown" : "plain";
}

function extractVideoUrls(text: string): VideoMedia[] {
  const media: VideoMedia[] = [];
  const seen = new Set<string>();

  for (const match of text.matchAll(YOUTUBE_REGEX)) {
    const videoId = match[1];
    const url = `https://www.youtube.com/embed/${videoId}`;
    if (!seen.has(url)) {
      seen.add(url);
      media.push({ type: "video", url, provider: "youtube" });
    }
  }

  for (const match of text.matchAll(VIMEO_REGEX)) {
    const videoId = match[1];
    const url = `https://player.vimeo.com/video/${videoId}`;
    if (!seen.has(url)) {
      seen.add(url);
      media.push({ type: "video", url, provider: "vimeo" });
    }
  }

  return media;
}

function processMarkdown(content: string): {
  sections: ArticleSection[];
  media: MediaItem[];
} {
  const tokens = marked.lexer(content);
  const sections: ArticleSection[] = [];
  const media: MediaItem[] = [];
  const seenMediaUrls = new Set<string>();

  function addMedia(item: MediaItem) {
    if (!seenMediaUrls.has(item.url)) {
      seenMediaUrls.add(item.url);
      media.push(item);
    }
  }

  for (const token of tokens) {
    switch (token.type) {
      case "heading":
        sections.push({
          type: "heading",
          level: token.depth as 1 | 2 | 3 | 4 | 5 | 6,
          content: token.text,
        });
        break;

      case "paragraph": {
        // Check for images in the paragraph
        const imgMatches = token.text.matchAll(
          /!\[([^\]]*)\]\(([^)]+)\)/g
        );
        for (const m of imgMatches) {
          const imgSection: ArticleSection = {
            type: "image",
            url: m[2],
            alt: m[1] || undefined,
          };
          sections.push(imgSection);
          addMedia({ type: "image", url: m[2], alt: m[1] || undefined });
        }

        // Check for standalone image URLs
        const standaloneImgs = token.text.matchAll(IMAGE_URL_REGEX);
        for (const m of standaloneImgs) {
          if (!seenMediaUrls.has(m[0])) {
            sections.push({ type: "image", url: m[0] });
            addMedia({ type: "image", url: m[0] });
          }
        }

        // Check for video URLs
        const videoMedia = extractVideoUrls(token.text);
        for (const v of videoMedia) {
          addMedia(v);
          sections.push({ type: "video", url: v.url, provider: v.provider });
        }

        // Add the paragraph itself if it has non-media text
        const cleanedText = token.text
          .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
          .replace(IMAGE_URL_REGEX, "")
          .replace(YOUTUBE_REGEX, "")
          .replace(VIMEO_REGEX, "")
          .trim();

        if (cleanedText) {
          sections.push({ type: "paragraph", content: token.text });
        }
        break;
      }

      case "blockquote":
        sections.push({
          type: "blockquote",
          content: token.text,
        });
        break;

      case "code": {
        // Auto-detect language if not specified in markdown
        const lang = token.lang || detectCodeLanguage(token.text);
        sections.push({
          type: "code",
          content: token.text,
          language: lang,
        });
        break;
      }

      case "list":
        sections.push({
          type: "list",
          ordered: token.ordered ?? false,
          items: token.items.map(
            (item: { text: string }) => item.text
          ),
        });
        break;

      case "table": {
        const tableToken = token as {
          header: { text: string }[];
          rows: { text: string }[][];
        };
        sections.push({
          type: "table",
          headers: tableToken.header.map((h) => h.text),
          rows: tableToken.rows.map((row) => row.map((cell) => cell.text)),
        });
        break;
      }

      case "space":
        break;

      default:
        // For any other token with text, add as paragraph
        if ("text" in token && typeof token.text === "string" && token.text.trim()) {
          sections.push({ type: "paragraph", content: token.text });
        }
        break;
    }
  }

  return { sections, media };
}

function processPlainText(content: string): {
  sections: ArticleSection[];
  media: MediaItem[];
} {
  const sections: ArticleSection[] = [];
  const media: MediaItem[] = [];
  const seenMediaUrls = new Set<string>();

  const normalized = content.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const blocks = normalized.split(/\n{2,}/);

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Extract image URLs
    for (const match of trimmed.matchAll(IMAGE_URL_REGEX)) {
      if (!seenMediaUrls.has(match[0])) {
        seenMediaUrls.add(match[0]);
        sections.push({ type: "image", url: match[0] });
        media.push({ type: "image", url: match[0] });
      }
    }

    // Extract video URLs
    const videoMedia = extractVideoUrls(trimmed);
    for (const v of videoMedia) {
      if (!seenMediaUrls.has(v.url)) {
        seenMediaUrls.add(v.url);
        sections.push({ type: "video", url: v.url, provider: v.provider });
        media.push(v);
      }
    }

    // Add the text block as paragraph (if it has non-URL content)
    const cleanedText = trimmed
      .replace(IMAGE_URL_REGEX, "")
      .replace(YOUTUBE_REGEX, "")
      .replace(VIMEO_REGEX, "")
      .trim();

    if (cleanedText) {
      sections.push({ type: "paragraph", content: trimmed });
    }
  }

  return { sections, media };
}

export async function processText(
  content: string,
  format?: "plain" | "markdown"
): Promise<ProcessingResult> {
  const trimmed = content.trim();
  console.log(`[text-processor] Input: ${trimmed.length} chars, format hint: ${format || "auto-detect"}`);

  if (!trimmed) {
    console.log("[text-processor] Empty content provided");
    return {
      title: "Untitled",
      excerpt: "",
      siteName: null,
      sections: [],
      media: [],
      errorMessage: "Empty content provided",
    };
  }

  const detectedFormat = format || detectFormat(trimmed);
  console.log(`[text-processor] Detected format: ${detectedFormat}`);

  const { sections, media } =
    detectedFormat === "markdown"
      ? processMarkdown(trimmed)
      : processPlainText(trimmed);

  console.log(`[text-processor] Produced ${sections.length} sections, ${media.length} media items`);

  // Extract title
  const firstHeading = sections.find((s) => s.type === "heading");
  const firstParagraph = sections.find((s) => s.type === "paragraph");

  let title: string;
  if (firstHeading && "content" in firstHeading) {
    title = firstHeading.content;
  } else if (firstParagraph && "content" in firstParagraph) {
    title =
      firstParagraph.content.length > 100
        ? firstParagraph.content.substring(0, 100) + "…"
        : firstParagraph.content;
  } else {
    title = "Untitled";
  }

  // Extract excerpt
  const excerpt = firstParagraph
    ? "content" in firstParagraph
      ? firstParagraph.content.substring(0, 280)
      : ""
    : "";

  console.log(`[text-processor] Done — title: "${title}", sections: ${sections.length}`);

  return {
    title,
    excerpt,
    siteName: null,
    sections,
    media,
  };
}
