import { splitTextIntoSentences } from "@/lib/split-sentences";
import type { Message } from "@/shared/message";
import "./content.css";

// Extracts sentences from the page, highlights the spoken one via the
// CSS Custom Highlight API, and handles on-page controls while reading
// (space/arrows/click-to-jump).

// must match ::highlight(...) in content.css

const HIGHLIGHT_NAME = "sr-sentence";
const BLOCK_SELECTOR = "p, h1, h2, h3, h4, h5, h6, li, blockquote";
const SKIP_ANCESTORS = "nav, header, footer, aside, [aria-hidden='true']";

declare global {
  interface Window {
    __srRanges?: Range[];
  }
}

function isVisible(el: Element): boolean {
  return el.getClientRects().length > 0;
}

// Split one block's text into sentences, each with a DOM Range.
// Normalizes whitespace but tracks each char's original (node, offset)
// so sentence boundaries map back to exact Range positions.
export function extractFromBlock(block: Element): {
  text: string;
  range: Range;
}[] {
  const walker = document.createTreeWalker(block, NodeFilter.SHOW_TEXT, {
    acceptNode: (node) =>
      node.parentElement?.closest("script, style, noscript")
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_ACCEPT,
  });

  let normalized = "";
  // positions[i] = DOM location of normalized[i]
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

  if (normalized.trim().length < 2) return [];

  const sentences = splitTextIntoSentences(normalized);
  const result: { text: string; range: Range }[] = [];
  let cursor = 0;
}
