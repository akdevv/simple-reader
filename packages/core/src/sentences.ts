const ABBREVIATIONS = new Set([
  "mr",
  "mrs",
  "ms",
  "dr",
  "prof",
  "sr",
  "jr",
  "vs",
  "etc",
  "e.g",
  "i.e",
  "inc",
  "ltd",
  "co",
  "st",
  "no",
  "u.s",
  "u.k",
]);

/**
 * Split text into sentences without breaking on "Dr.", "3.14", "e.g."
 * Deliberately simple: break on ./!/? followed by whitespace or end of text.
 */
export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    // Decimal point between digits: "3.14"
    if (
      ch === "." &&
      /\d/.test(text[i - 1] ?? "") &&
      /\d/.test(text[i + 1] ?? "")
    ) {
      continue;
    }

    if (i + 1 < text.length && !/\s/.test(text[i + 1]!)) continue;

    const candidate = text.slice(start, i + 1).trim();
    const lastWord = candidate
      .split(/\s+/)
      .pop()
      ?.replace(/\.$/, "")
      .toLowerCase();
    if (lastWord && ABBREVIATIONS.has(lastWord)) continue;

    if (candidate) sentences.push(candidate);
    start = i + 1;
  }

  const rest = text.slice(start).trim();
  if (rest) sentences.push(rest);

  return sentences;
}
