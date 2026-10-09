import { expect, it } from "vitest";
import { cleanSuggestion } from "./suggest";

const cats = ["Tech", "Science", "Other"];

it("matches categories case-insensitively", () => {
  expect(
    cleanSuggestion({ category: " science ", tags: [] }, cats).category,
  ).toBe("Science");
});

it("falls back to Other for unknown or missing categories", () => {
  expect(cleanSuggestion({ category: "Sports" }, cats).category).toBe("Other");
  expect(cleanSuggestion(null, cats)).toEqual({ category: "Other", tags: [] });
  expect(cleanSuggestion("nonsense", cats)).toEqual({
    category: "Other",
    tags: [],
  });
});

it("lowercases, dedupes, drops junk and caps tags at 5", () => {
  const { tags } = cleanSuggestion(
    {
      category: "Tech",
      tags: [
        "#AI",
        "ai",
        "Machine  Learning",
        42,
        "",
        "x".repeat(41),
        "a",
        "b",
        "c",
        "d",
      ],
    },
    cats,
  );
  expect(tags).toEqual(["ai", "machine learning", "a", "b", "c"]);
});
