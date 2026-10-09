// @vitest-environment happy-dom
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, it, expect } from "vitest";
import { extract } from "../src/extract";
import { mapText, rangeAt, segment } from "../src/segment";

function render(html: string): HTMLElement {
  const root = document.createElement("div");
  root.innerHTML = html;
  return root;
}

describe("segment", () => {
  it("maps each sentence to a Range covering exactly its text", () => {
    const root = render("<p>Hello <b>big</b>   world. Dr. Who   is here!</p>");
    const sentences = segment(root);
    expect(sentences.map((s) => s.text)).toEqual([
      "Hello big world.",
      "Dr. Who is here!",
    ]);
    expect(sentences[0]!.range.toString()).toBe("Hello big   world.");
    expect(sentences[1]!.range.toString()).toBe("Dr. Who   is here!");
  });

  it("never joins sentences across blocks", () => {
    const root = render("<h2>A heading</h2><p>Body text.</p>");
    expect(segment(root).map((s) => s.text)).toEqual([
      "A heading",
      "Body text.",
    ]);
  });

  it("keeps a list item's own text when it contains a nested list", () => {
    const root = render("<ul><li>Outer<ul><li>Inner.</li></ul></li></ul>");
    expect(segment(root).map((s) => s.text)).toEqual(["Outer", "Inner."]);
  });

  it("skips scripts and styles", () => {
    const root = render(
      "<p>Seen.<script>var x = 1;</script><style>p{}</style></p>",
    );
    expect(segment(root).map((s) => s.text)).toEqual(["Seen."]);
  });

  it("segments an extracted article", () => {
    const html = readFileSync(
      `${import.meta.dirname}/fixtures/article.html`,
      "utf8",
    );
    const article = extract(parseHTML(html).document, "https://example.com/a")!;
    const texts = segment(render(article.html)).map((s) => s.text);
    expect(texts).toContain("Most adults need about 7.5 hours a night.");
    expect(texts).toContain("What happens at night");
    expect(texts).toContain("Keep the bedroom dark and cool.");
    expect(texts.some((t) => t.startsWith("Dr. Smith, who has studied"))).toBe(
      true,
    );
  });
});

describe("mapText + rangeAt", () => {
  it("round-trips offsets to ranges", () => {
    const root = render("<p>One  <i>two</i></p><p>three</p>");
    const map = mapText(root);
    const start = map.text.indexOf("two");
    expect(rangeAt(map, start, start + 3)!.toString()).toBe("two");
  });
});
