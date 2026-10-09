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

export function splitTextIntoSentences(txt: string): string[] {
  const sentences: string[] = [];
  let start = 0;

  for (let i = 0; i < txt.length; i++) {
    const ch = txt[i];
    if (ch !== "." && ch !== "!" && ch !== "?") continue;

    // Decimal point between digits: "3.14" — not a sentence break.
    if (
      ch === "." &&
      /\d/.test(txt[i - 1] ?? "") &&
      /\d/.test(txt[i + 1] ?? "")
    ) {
      continue;
    }

    // Only a break if followed by whitespace (or end of string).
    if (i + 1 < txt.length && !/\s/.test(txt[i + 1])) continue;

    const candidate = txt.slice(start, i + 1).trim();
    const lastWord = candidate
      .split(/\s+/)
      .pop()
      ?.replace(/\.$/, "")
      .toLowerCase();
    if (lastWord && ABBREVIATIONS.has(lastWord)) continue;

    if (candidate) sentences.push(candidate);
    start = i + 1;
  }

  const rest = txt.slice(start).trim();
  if (rest) sentences.push(rest);

  return sentences;
}
