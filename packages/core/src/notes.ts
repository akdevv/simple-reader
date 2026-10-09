import { rangeAt, type TextMap } from "./segment";

export interface Anchor {
  /** char offsets into mapText(articleRoot).text */
  start: number;
  end: number;
  quote: string;
}

/**
 * A selection inside the article → offsets that survive a reload.
 * Takes mapText(root) so many calls share one map. Null if nothing selected.
 */
// ponytail: linear scan with isPointInRange per char; binary search if long articles feel slow
export function anchorFromRange(map: TextMap, range: Range): Anchor | null {
  const inside = (i: number) => {
    const p = map.positions[i]!;
    try {
      return (
        range.isPointInRange(p.node, p.offset) &&
        range.isPointInRange(p.node, p.offset + 1)
      );
    } catch {
      return false; // node from another document/tree
    }
  };
  let start = -1;
  let end = -1;
  for (let i = 0; i < map.positions.length; i++) {
    if (inside(i)) {
      if (start === -1) start = i;
      end = i + 1;
    } else if (start !== -1) break;
  }
  if (start === -1) return null;
  // trim selected whitespace at the edges
  while (start < end && map.text[start] === " ") start++;
  while (end > start && map.text[end - 1] === " ") end--;
  if (start === end) return null;
  return { start, end, quote: map.text.slice(start, end) };
}

/**
 * Stored offsets → Range. Stored articles never change, so the offsets
 * should always match; if not, find the quote instead.
 */
export function rangeFromAnchor(map: TextMap, anchor: Anchor): Range | null {
  if (map.text.slice(anchor.start, anchor.end) === anchor.quote)
    return rangeAt(map, anchor.start, anchor.end);
  const i = map.text.indexOf(anchor.quote);
  return i === -1 ? null : rangeAt(map, i, i + anchor.quote.length);
}
