"use client";

import React from "react";
import { Sentence } from "@/lib/types/audio";
import { stripMarkdownFormatting, splitTextIntoSentences } from "@/lib/utils/split-sentences";

// Same regex as RichText in the article page
const TOKEN_REGEX =
  /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|~~(.+?)~~/g;

/** Parse inline markdown into React nodes (mirrors RichText logic) */
function parseInlineMarkdown(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  // Reset regex state
  TOKEN_REGEX.lastIndex = 0;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const key = keyCounter++;

    if (match[1] !== undefined && match[2] !== undefined) {
      parts.push(
        <a
          key={key}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline decoration-primary/25 underline-offset-[3px] transition-all hover:decoration-primary/60"
        >
          {match[1]}
        </a>,
      );
    } else if (match[3] !== undefined) {
      parts.push(
        <strong key={key} className="font-semibold text-foreground">
          {match[3]}
        </strong>,
      );
    } else if (match[4] !== undefined) {
      parts.push(
        <em key={key} className="italic">
          {match[4]}
        </em>,
      );
    } else if (match[5] !== undefined) {
      parts.push(
        <code
          key={key}
          className="inline-block rounded-md bg-muted/60 border border-border/40 px-1.5 py-0.5 font-mono text-[0.85em] text-primary/90"
        >
          {match[5]}
        </code>,
      );
    } else if (match[6] !== undefined) {
      parts.push(
        <del key={key} className="text-muted-foreground line-through">
          {match[6]}
        </del>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * Split the original (markdown-formatted) text at the same sentence boundaries
 * that splitTextIntoSentences would produce on the stripped version.
 *
 * Strategy: strip markdown, split into sentences, then find each sentence's
 * position in the stripped text and map those offsets back to the original text.
 */
function splitMarkdownTextBySentences(
  originalText: string,
  sentenceCount: number,
): string[] {
  if (sentenceCount <= 1) return [originalText];

  const stripped = stripMarkdownFormatting(originalText);
  const sentences = splitTextIntoSentences(stripped);

  if (sentences.length <= 1) return [originalText];

  // Build a mapping from stripped positions to original positions.
  // Walk both strings simultaneously, skipping formatting markers in the original.
  const strippedToOriginal = buildOffsetMap(originalText, stripped);

  const chunks: string[] = [];
  let lastOriginalOffset = 0;

  for (let i = 0; i < sentences.length; i++) {
    const sentence = sentences[i];

    // Find where this sentence starts in the stripped text
    const strippedStart = findSentenceStart(stripped, sentence, i, sentences);
    const strippedEnd = strippedStart + sentence.length;

    // Map to original text positions
    const originalEnd = strippedToOriginal.get(strippedEnd) ?? originalText.length;

    if (i === sentences.length - 1) {
      // Last sentence: take everything remaining
      chunks.push(originalText.slice(lastOriginalOffset).trim());
    } else {
      // Find the split point: include trailing space in this chunk
      let splitPoint = originalEnd;
      while (splitPoint < originalText.length && originalText[splitPoint] === " ") {
        splitPoint++;
      }
      chunks.push(originalText.slice(lastOriginalOffset, splitPoint).trim());
      lastOriginalOffset = splitPoint;
    }
  }

  return chunks.filter(Boolean);
}

/**
 * Build a map from character positions in the stripped text
 * to character positions in the original markdown text.
 */
function buildOffsetMap(
  original: string,
  stripped: string,
): Map<number, number> {
  const map = new Map<number, number>();
  let oi = 0; // original index
  let si = 0; // stripped index

  map.set(0, 0);

  while (si < stripped.length && oi < original.length) {
    // Check if we're at a markdown formatting sequence to skip
    const skip = getMarkdownSkipLength(original, oi, stripped, si);
    if (skip > 0) {
      oi += skip;
      continue;
    }

    // Characters should match
    if (original[oi] === stripped[si]) {
      si++;
      oi++;
      map.set(si, oi);
    } else {
      // Mismatch — advance original (likely formatting)
      oi++;
    }
  }

  // Map the end position
  map.set(stripped.length, original.length);

  return map;
}

/**
 * Detect markdown formatting sequences at current position in the original text
 * that should be skipped (they don't appear in the stripped text).
 */
function getMarkdownSkipLength(
  original: string,
  oi: number,
  stripped: string,
  si: number,
): number {
  // Link: [text](url) — skip `[`, then after text skip `](url)`
  if (original[oi] === "[" && stripped[si] !== "[") {
    // We're at the start of a markdown link, skip the `[`
    return 1;
  }
  if (original[oi] === "]" && original[oi + 1] === "(") {
    // Skip `](url)`
    const closeIdx = original.indexOf(")", oi + 2);
    if (closeIdx !== -1) {
      return closeIdx - oi + 1;
    }
  }

  // Bold: **
  if (original[oi] === "*" && original[oi + 1] === "*" && stripped[si] !== "*") {
    return 2;
  }

  // Italic: * (single, not **)
  if (
    original[oi] === "*" &&
    original[oi + 1] !== "*" &&
    stripped[si] !== "*"
  ) {
    return 1;
  }

  // Strikethrough: ~~
  if (original[oi] === "~" && original[oi + 1] === "~" && stripped[si] !== "~") {
    return 2;
  }

  // Inline code: `
  if (original[oi] === "`" && stripped[si] !== "`") {
    return 1;
  }

  return 0;
}

/** Find where a sentence starts in the stripped text */
function findSentenceStart(
  stripped: string,
  sentence: string,
  sentenceIndex: number,
  allSentences: string[],
): number {
  // Sum up the positions of all previous sentences
  let pos = 0;
  for (let i = 0; i < sentenceIndex; i++) {
    const idx = stripped.indexOf(allSentences[i], pos);
    if (idx !== -1) {
      pos = idx + allSentences[i].length;
    }
  }
  const found = stripped.indexOf(sentence, pos);
  return found !== -1 ? found : pos;
}

interface SentenceTextProps {
  text: string;
  sentences: Sentence[];
  activeSentenceId: string | null;
  onSentenceClick?: (sentenceId: string) => void;
}

export function SentenceText({
  text,
  sentences,
  activeSentenceId,
  onSentenceClick,
}: SentenceTextProps) {
  if (sentences.length === 0) {
    // Fallback: render as regular RichText
    const parts = parseInlineMarkdown(text);
    return <>{parts.length > 0 ? parts : text}</>;
  }

  const chunks = splitMarkdownTextBySentences(text, sentences.length);

  return (
    <>
      {chunks.map((chunk, i) => {
        const sentence = sentences[i];
        if (!sentence) {
          return (
            <React.Fragment key={`chunk-${i}`}>
              {parseInlineMarkdown(chunk)}
            </React.Fragment>
          );
        }

        const isActive = sentence.id === activeSentenceId;

        return (
          <span
            key={sentence.id}
            data-sentence-id={sentence.id}
            className={isActive ? "sentence-active" : "sentence"}
            onClick={(e) => {
              e.stopPropagation();
              onSentenceClick?.(sentence.id);
            }}
          >
            {parseInlineMarkdown(chunk)}
          </span>
        );
      })}
    </>
  );
}
