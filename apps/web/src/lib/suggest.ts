// Gemini category + tag suggestions. No DB or Astro imports, so it's unit-testable.

const ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const TIMEOUT_MS = 15_000;
const MAX_TAGS = 5;

export interface Suggestion {
  category: string;
  tags: string[];
}

export interface SuggestInput {
  title: string;
  siteName: string | null;
  excerpt: string | null;
  text: string;
}

/** "#Machine  Learning " → "machine learning"; null if unusable. */
export function cleanTag(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const tag = raw.toLowerCase().replace(/^#+/, "").replace(/\s+/g, " ").trim();
  return tag && tag.length <= 40 ? tag : null;
}

/** Never trust the model's reply: unknown category → "Other", tags cleaned and capped. */
export function cleanSuggestion(
  raw: unknown,
  categories: string[],
): Suggestion {
  const obj = (raw && typeof raw === "object" ? raw : {}) as Record<
    string,
    unknown
  >;
  const wanted =
    typeof obj.category === "string" ? obj.category.trim().toLowerCase() : "";
  const category =
    categories.find((c) => c.toLowerCase() === wanted) ?? "Other";
  const tags = [
    ...new Set(
      (Array.isArray(obj.tags) ? obj.tags : [])
        .map(cleanTag)
        .filter((t) => t !== null),
    ),
  ].slice(0, MAX_TAGS);
  return { category, tags };
}

/** One Gemini call. Throws on any failure; callers fall back to "Other". */
export async function suggest(
  input: SuggestInput,
  categories: string[],
  existingTags: string[],
  { apiKey, model }: { apiKey: string; model: string },
): Promise<Suggestion> {
  const prompt = [
    `Categorize this article. Pick exactly one category from: ${categories.join(", ")}.`,
    `Suggest up to ${MAX_TAGS} short lowercase topic tags.`,
    existingTags.length
      ? `Prefer these existing tags when they fit, instead of near-duplicates: ${existingTags.join(", ")}.`
      : "",
    `Reply with JSON only: {"category": string, "tags": string[]}.`,
    "",
    `Title: ${input.title}`,
    `Site: ${input.siteName ?? ""}`,
    `Excerpt: ${input.excerpt ?? ""}`,
    `Text: ${input.text.slice(0, 3000)}`,
  ].join("\n");

  const res = await fetch(ENDPOINT, {
    method: "POST",
    signal: AbortSignal.timeout(TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      temperature: 0,
    }),
  });
  if (!res.ok)
    throw new Error(
      `Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`,
    );
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const content = data.choices?.[0]?.message?.content ?? "";
  // tolerate ```json fences around the object
  const json = content.slice(
    content.indexOf("{"),
    content.lastIndexOf("}") + 1,
  );
  return cleanSuggestion(JSON.parse(json), categories);
}
