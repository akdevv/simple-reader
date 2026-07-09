/**
 * Splits normalized text into sentences. Deliberately simple: split on
 * ./!/? followed by whitespace, but don't split on common abbreviations
 * or a decimal point between digits (e.g. "3.14", "Mr. Smith").
 */
const ABBREVIATIONS = new Set([
  "mr", "mrs", "ms", "dr", "prof", "sr", "jr", "vs", "etc", "e.g", "i.e",
  "inc", "ltd", "co", "st", "no", "u.s", "u.k",
]);

export function splitTextIntoSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    // Decimal point between digits: "3.14" — not a sentence break.
    if (ch === "." && /\d/.test(text[i - 1] ?? "") && /\d/.test(text[i + 1] ?? "")) {
      continue;
    }

    // Only a break if followed by whitespace (or end of string).
    if (i + 1 < text.length && !/\s/.test(text[i + 1])) continue;

    const candidate = text.slice(start, i + 1).trim();
    const lastWord = candidate.split(/\s+/).pop()?.replace(/\.$/, "").toLowerCase();
    if (lastWord && ABBREVIATIONS.has(lastWord)) continue;

    if (candidate) sentences.push(candidate);
    start = i + 1;
  }

  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);

  return sentences;
}
