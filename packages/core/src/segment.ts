import { splitSentences } from "./sentences";

export interface Sentence {
  text: string;
  range: Range;
}

export interface TextMap {
  /** whitespace-collapsed text */
  text: string;
  /** DOM location of each char in text */
  positions: { node: Text; offset: number }[];
}

// Text is grouped by its nearest block ancestor, so a sentence never spans
// two paragraphs and a heading without a period doesn't merge into the next one.
const BLOCKS =
  "p, h1, h2, h3, h4, h5, h6, li, blockquote, figcaption, pre, td, th, dt, dd, div, section, article";
const SKIP = new Set(["SCRIPT", "STYLE", "NOSCRIPT", "TEMPLATE"]);

function textNodes(root: Node, out: Text[] = []): Text[] {
  for (const child of root.childNodes) {
    if (child.nodeType === 3) out.push(child as Text);
    else if (child.nodeType === 1 && !SKIP.has((child as Element).tagName))
      textNodes(child, out);
  }
  return out;
}

function mapNodes(nodes: Text[]): TextMap {
  let text = "";
  const positions: TextMap["positions"] = [];
  for (const node of nodes) {
    const data = node.data;
    for (let i = 0; i < data.length; i++) {
      const ch = /\s/.test(data[i]!) ? " " : data[i]!;
      if (ch === " " && (text === "" || text.endsWith(" "))) continue;
      text += ch;
      positions.push({ node, offset: i });
    }
  }
  return { text, positions };
}

/** Whole-root text with collapsed whitespace, each char mapped back to the DOM. */
export function mapText(root: Node): TextMap {
  return mapNodes(textNodes(root));
}

/** Range covering text[start, end) of a TextMap. */
export function rangeAt(
  map: TextMap,
  start: number,
  end: number,
): Range | null {
  const a = map.positions[start];
  const b = map.positions[end - 1];
  if (!a || !b) return null;
  const range = a.node.ownerDocument.createRange();
  range.setStart(a.node, a.offset);
  range.setEnd(b.node, b.offset + 1);
  return range;
}

/** Rendered article DOM → sentences, each mapped back to an exact Range. */
export function segment(root: HTMLElement): Sentence[] {
  // consecutive text nodes sharing a block form one group
  const groups: Text[][] = [];
  let lastBlock: Element | null = null;
  for (const node of textNodes(root)) {
    const block = node.parentElement?.closest(BLOCKS) ?? root;
    if (block !== lastBlock || !groups.length) groups.push([]);
    groups.at(-1)!.push(node);
    lastBlock = block;
  }

  const results: Sentence[] = [];
  for (const nodes of groups) {
    const map = mapNodes(nodes);
    if (map.text.trim().length < 2) continue;
    let cursor = 0;
    for (const sentence of splitSentences(map.text)) {
      const start = map.text.indexOf(sentence, cursor);
      if (start === -1) continue;
      cursor = start + sentence.length;
      const range = rangeAt(map, start, cursor);
      if (range) results.push({ text: sentence, range });
    }
  }
  return results;
}
