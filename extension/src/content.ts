import { splitTextIntoSentences } from "@/lib/utils/split-sentences";
import type { Message } from "./messages";
import { loadSettings, onSettingsChanged } from "./settings";

/**
 * Content script: extracts readable sentences from the live DOM and
 * highlights the currently-spoken one in place using the native
 * CSS Custom Highlight API (no DOM mutation).
 */

const HIGHLIGHT_NAME = "simple-reader-sentence";
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li, blockquote";
const SKIP_ANCESTORS = "nav, header, footer, aside, [aria-hidden='true']";

declare global {
  interface Window {
    __simpleReaderRanges?: Range[];
  }
}

function isVisible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

/**
 * Build sentence texts + DOM Ranges for one block element.
 * Walks text nodes, builds a whitespace-normalized string while keeping a
 * map from each normalized char back to its (node, offset), then splits
 * the normalized text into sentences and maps them back to Ranges.
 */
export function extractFromBlock(
  block: Element,
): { text: string; range: Range }[] {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("script, style, noscript")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  let normalized = "";
  // position of normalized[i] in the DOM
  const positions: { node: Text; offset: number }[] = [];

  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = (node as Text).data;
    for (let i = 0; i < text.length; i++) {
      const ch = /\s/.test(text[i]) ? " " : text[i];
      if (ch === " " && (normalized === "" || normalized.endsWith(" "))) {
        continue; // collapse whitespace runs
      }
      normalized += ch;
      positions.push({ node: node as Text, offset: i });
    }
  }

  const trimmed = normalized.trim();
  if (trimmed.length < 2) return [];

  const sentences = splitTextIntoSentences(normalized);
  const results: { text: string; range: Range }[] = [];
  let cursor = 0;

  for (const sentence of sentences) {
    const start = normalized.indexOf(sentence, cursor);
    if (start === -1) continue;
    const end = start + sentence.length - 1;
    cursor = start + sentence.length;

    const startPos = positions[start];
    const endPos = positions[end];
    if (!startPos || !endPos) continue;

    const range = document.createRange();
    range.setStart(startPos.node, startPos.offset);
    range.setEnd(endPos.node, endPos.offset + 1);
    results.push({ text: sentence, range });
  }

  return results;
}

function extractPage(): { texts: string[]; ranges: Range[] } {
  const candidates = Array.from(
    document.body.querySelectorAll(BLOCK_SELECTOR),
  ).filter(
    (el) =>
      isVisible(el) &&
      !el.closest(SKIP_ANCESTORS) &&
      // keep innermost blocks only (e.g. skip a blockquote that contains a <p>)
      !el.querySelector(BLOCK_SELECTOR),
  );

  const texts: string[] = [];
  const ranges: Range[] = [];
  for (const block of candidates) {
    for (const { text, range } of extractFromBlock(block)) {
      texts.push(text);
      ranges.push(range);
    }
  }
  return { texts, ranges };
}

function highlight(index: number): void {
  const ranges = window.__simpleReaderRanges;
  const range = ranges?.[index];
  if (!range) return;
  CSS.highlights.set(HIGHLIGHT_NAME, new Highlight(range));

  const rect = range.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    range.startContainer.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}

/** Overrides the default color from content.css with the user's choice. */
function applyHighlightColor(color: string): void {
  let style = document.getElementById(
    "simple-reader-style",
  ) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement("style");
    style.id = "simple-reader-style";
    document.head.appendChild(style);
  }
  style.textContent = `::highlight(${HIGHLIGHT_NAME}) { background-color: ${color}; color: inherit; }`;
}

// Guard against double-injection: register the listener only once.
// (typeof check lets the pure extraction logic run under jsdom in tests)
if (typeof chrome !== "undefined" && chrome.runtime && !window.__simpleReaderRanges) {
  window.__simpleReaderRanges = [];

  chrome.runtime.onMessage.addListener(
    (msg: Message | { type: "sr:extract" }) => {
      switch (msg.type) {
        case "sr:extract": {
          const { texts, ranges } = extractPage();
          window.__simpleReaderRanges = ranges;
          chrome.runtime.sendMessage({
            type: "sr:sentences",
            texts,
            pageKey: location.href,
          } satisfies Message);
          break;
        }
        case "sr:highlight":
          highlight(msg.index);
          break;
        case "sr:clear":
          CSS.highlights.delete(HIGHLIGHT_NAME);
          break;
      }
    },
  );

  // Settings are cosmetic — never let them break the reader itself.
  try {
    loadSettings().then((s) => applyHighlightColor(s.highlightColor));
    onSettingsChanged((patch) => {
      if (patch.highlightColor) applyHighlightColor(patch.highlightColor);
    });
  } catch (err) {
    console.error("[simple-reader] settings unavailable:", err);
  }
}
