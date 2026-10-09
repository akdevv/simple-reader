import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
import { describe, it, expect } from "vitest";
import { extract } from "../src/extract";

const html = readFileSync(
  `${import.meta.dirname}/fixtures/article.html`,
  "utf8",
);
const url = "https://www.example.com/2025/why-sleep";

describe("extract (linkedom, as on the server)", () => {
  const article = extract(parseHTML(html).document, url)!;

  it("pulls metadata", () => {
    expect(article.title).toBe("Why Sleep Matters");
    expect(article.byline).toBe("Jane Doe");
    expect(article.siteName).toBe("Example Journal");
    expect(article.publishedAt).toBe("2025-03-14T09:00:00Z");
    expect(article.excerpt).toBe(
      "A short look at what happens while we sleep.",
    );
  });

  it("keeps the body, drops nav and footer", () => {
    expect(article.text).toContain("Most adults need about 7.5 hours a night.");
    expect(article.text).toContain("Skip caffeine after lunch.");
    expect(article.text).not.toContain("Subscribe now");
    expect(article.text).not.toContain("All rights reserved");
  });

  it("absolutizes links and images", () => {
    expect(article.html).toContain('href="https://www.example.com/labs/sleep"');
    expect(article.html).toContain(
      'src="https://www.example.com/img/night.jpg"',
    );
  });

  it("does not mutate the input document", () => {
    const { document } = parseHTML(html);
    extract(document, url);
    expect(document.querySelector("nav")).not.toBeNull();
  });

  it("returns null when there is no article", () => {
    const { document } = parseHTML("<html><body></body></html>");
    expect(extract(document, url)).toBeNull();
  });
});
