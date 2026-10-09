import { describe, expect, it } from "vitest";
import { fetchPage, htmlToText, normalizeUrl, sanitize } from "./page";

describe("fetchPage refuses non-public targets", () => {
  it.each([
    "file:///etc/passwd",
    "ftp://example.com/",
    "http://localhost:4322/",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://169.254.169.254/latest/meta-data/",
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://0.0.0.0/",
  ])("%s", async (url) => {
    await expect(fetchPage(url)).rejects.toThrow(/not allowed|Only http/);
  });
});

describe("sanitize", () => {
  it("strips scripts, handlers and javascript: links", () => {
    const out = sanitize(
      `<p onclick="x()">Hi<script>alert(1)</script></p><a href="javascript:alert(1)">a</a><img src="data:image/png;base64,AA" onerror="x()"><iframe src="https://e.com"></iframe>`,
    );
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|data:|iframe/);
    expect(out).toContain("<p>Hi</p>");
  });

  it("keeps article markup and opens links safely", () => {
    const out = sanitize(
      `<h2>T</h2><figure><img src="https://e.com/a.jpg" alt="A"><figcaption>C</figcaption></figure><a href="https://e.com">l</a>`,
    );
    expect(out).toContain('<img src="https://e.com/a.jpg" alt="A" />');
    expect(out).toContain(
      '<a href="https://e.com" target="_blank" rel="noopener noreferrer nofollow">l</a>',
    );
  });
});

it("htmlToText collapses whitespace", () => {
  expect(htmlToText("<p>One\n  two</p><p>three</p>")).toBe("One two three");
});

it("normalizeUrl drops the fragment", () => {
  expect(normalizeUrl(" https://e.com/a?b=1#c ")).toBe("https://e.com/a?b=1");
});
