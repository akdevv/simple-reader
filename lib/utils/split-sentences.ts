import { ArticleSection } from "@/lib/types/article";
import { Sentence } from "@/lib/types/audio";

/** Common abbreviations that should not trigger sentence splits */
const ABBREVIATION_PATTERN =
  /\b(?:Mr|Mrs|Ms|Dr|Prof|Sr|Jr|vs|etc|Inc|Ltd|Corp|approx|dept|est|vol|Fig|fig|e\.g|i\.e|No|no|St|Ave|Blvd)\./g;

const PLACEHOLDER = "\u0000ABR\u0000";

/**
 * Strip markdown inline formatting, returning plain text.
 * `[text](url)` → `text`, `**text**` → `text`, etc.
 */
export function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // links
    .replace(/\*\*(.+?)\*\*/g, "$1") // bold
    .replace(/\*(.+?)\*/g, "$1") // italic
    .replace(/`([^`]+)`/g, "$1") // inline code
    .replace(/~~(.+?)~~/g, "$1"); // strikethrough
}

/**
 * Split a text string into sentences.
 * Handles abbreviations to avoid false splits.
 */
export function splitTextIntoSentences(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Replace abbreviations with placeholder to avoid false splits
  const abbreviations: string[] = [];
  const withPlaceholders = trimmed.replace(ABBREVIATION_PATTERN, (match) => {
    abbreviations.push(match);
    return PLACEHOLDER;
  });

  // Split on sentence-ending punctuation followed by space + uppercase or end
  const parts = withPlaceholders.split(/(?<=[.!?])\s+(?=[A-Z"\u201C])/);

  // Restore abbreviations in each part
  let abbrIndex = 0;
  const restored = parts.map((part) =>
    part.replace(new RegExp(PLACEHOLDER.replace(/\0/g, "\\0"), "g"), () => {
      return abbreviations[abbrIndex++] || "";
    }),
  );

  return restored.map((s) => s.trim()).filter(Boolean);
}

/**
 * Split article sections into a flat array of sentences.
 * Each sentence tracks which section (and list item) it came from.
 * Skips non-text sections (image, video, code, table).
 */
export function splitSentences(sections: ArticleSection[]): Sentence[] {
  const sentences: Sentence[] = [];
  let globalIndex = 0;

  for (let sIdx = 0; sIdx < sections.length; sIdx++) {
    const section = sections[sIdx];

    switch (section.type) {
      case "paragraph":
      case "heading":
      case "blockquote": {
        const plainText = stripMarkdownFormatting(section.content);
        const splits = splitTextIntoSentences(plainText);
        for (const text of splits) {
          sentences.push({
            id: `s-${globalIndex++}`,
            text,
            sectionIndex: sIdx,
          });
        }
        break;
      }

      case "list": {
        for (let iIdx = 0; iIdx < section.items.length; iIdx++) {
          const plainText = stripMarkdownFormatting(section.items[iIdx]);
          const splits = splitTextIntoSentences(plainText);
          for (const text of splits) {
            sentences.push({
              id: `s-${globalIndex++}`,
              text,
              sectionIndex: sIdx,
              itemIndex: iIdx,
            });
          }
        }
        break;
      }

      // Skip: image, video, code, table
      default:
        break;
    }
  }

  return sentences;
}
