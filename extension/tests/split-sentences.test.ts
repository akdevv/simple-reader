import { describe, it, expect } from "vitest";
import { splitTextIntoSentences } from "../src/lib/split-sentences";

describe("splitTextIntoSentences", () => {
  it("splits on . ! ? followed by whitespace", () => {
    expect(splitTextIntoSentences("One. Two! Three? Four.")).toEqual([
      "One.",
      "Two!",
      "Three?",
      "Four.",
    ]);
  });

  it("returns empty array for empty or whitespace-only input", () => {
    expect(splitTextIntoSentences("")).toEqual([]);
    expect(splitTextIntoSentences("   ")).toEqual([]);
  });

  it("keeps text without terminal punctuation as one sentence", () => {
    expect(splitTextIntoSentences("no punctuation here")).toEqual([
      "no punctuation here",
    ]);
  });

  it("keeps trailing text after last break", () => {
    expect(splitTextIntoSentences("Done. And then some")).toEqual([
      "Done.",
      "And then some",
    ]);
  });

  it("does not split on decimal points", () => {
    expect(splitTextIntoSentences("Pi is 3.14 exactly. Next.")).toEqual([
      "Pi is 3.14 exactly.",
      "Next.",
    ]);
  });

  it("does not split after common abbreviations", () => {
    expect(
      splitTextIntoSentences("Mr. Smith met Dr. Jones. They talked."),
    ).toEqual(["Mr. Smith met Dr. Jones.", "They talked."]);
  });

  it("handles dotted abbreviations like e.g. and i.e.", () => {
    expect(splitTextIntoSentences("Use fruit, e.g. apples. Simple.")).toEqual([
      "Use fruit, e.g. apples.",
      "Simple.",
    ]);
  });

  it("does not split mid-word punctuation like URLs", () => {
    expect(splitTextIntoSentences("Visit example.com now. Bye.")).toEqual([
      "Visit example.com now.",
      "Bye.",
    ]);
  });

  it("splits at end of string without trailing whitespace", () => {
    expect(splitTextIntoSentences("Only one sentence.")).toEqual([
      "Only one sentence.",
    ]);
  });

  it("handles newlines as whitespace after break", () => {
    expect(splitTextIntoSentences("First.\nSecond.")).toEqual([
      "First.",
      "Second.",
    ]);
  });
});
