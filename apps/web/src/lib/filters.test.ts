import { expect, it } from "vitest";
import { parseFilters, snippetHtml } from "./filters";

it("snippetHtml escapes content and only allows our <mark>", () => {
  expect(snippetHtml('a <script>x</script> \u0001word\u0002 & "q"')).toBe(
    "a &#60;script&#62;x&#60;/script&#62; <mark>word</mark> &#38; &#34;q&#34;",
  );
});

it("parseFilters defaults sort by whether there is a query", () => {
  expect(parseFilters(new URLSearchParams("q=sleep")).sort).toBe("relevance");
  expect(parseFilters(new URLSearchParams("")).sort).toBe("newest");
  expect(
    parseFilters(new URLSearchParams("sort=bogus&status=done")),
  ).toMatchObject({
    sort: "newest",
    status: "done",
  });
});
