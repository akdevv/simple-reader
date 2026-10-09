// @vitest-environment happy-dom
import { describe, expect, it } from "vitest";
import { anchorFromRange, rangeFromAnchor } from "../src/notes";
import { mapText } from "../src/segment";

function render(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  document.body.replaceChildren(root);
  return root;
}

function select(root: HTMLElement, from: string, to: string): Range {
  // range from the start of `from` to the end of `to` (each inside one text node)
  const nodes: Text[] = [];
  const walk = (n: Node) =>
    n.childNodes.forEach((c) =>
      c.nodeType === 3 ? nodes.push(c as Text) : walk(c),
    );
  walk(root);
  const a = nodes.find((n) => n.data.includes(from))!;
  const b = nodes.find((n) => n.data.includes(to))!;
  const range = document.createRange();
  range.setStart(a, a.data.indexOf(from));
  range.setEnd(b, b.data.indexOf(to) + to.length);
  return range;
}

describe("anchors", () => {
  const html =
    "<p>The quick   <b>brown</b> fox.</p><p>Jumps over\n the dog.</p>";

  it("turns a selection across elements into collapsed-text offsets", () => {
    const root = render(html);
    const map = mapText(root);
    const anchor = anchorFromRange(map, select(root, "quick", "fox"))!;
    expect(anchor.quote).toBe("quick brown fox");
    expect(map.text.slice(anchor.start, anchor.end)).toBe(anchor.quote);
  });

  it("round-trips to a Range with the same text", () => {
    const root = render(html);
    const map = mapText(root);
    const anchor = anchorFromRange(map, select(root, "over", "dog"))!;
    const range = rangeFromAnchor(mapText(render(html)), anchor)!;
    expect(range.toString()).toBe("over\n the dog");
  });

  it("trims whitespace at the edges and ignores empty selections", () => {
    const root = render(html);
    const map = mapText(root);
    expect(anchorFromRange(map, select(root, " fox", "fox"))!.quote).toBe(
      "fox",
    );
    const empty = document.createRange();
    empty.setStart(root, 0);
    expect(anchorFromRange(map, empty)).toBeNull();
  });

  it("falls back to finding the quote when offsets drift", () => {
    const root = render(html);
    const range = rangeFromAnchor(mapText(root), {
      start: 0,
      end: 5,
      quote: "brown fox",
    })!;
    expect(range.toString()).toBe("brown fox");
    expect(
      rangeFromAnchor(mapText(root), { start: 0, end: 3, quote: "missing" }),
    ).toBeNull();
  });
});
