import { describe, it, expect } from "vitest";
import { splitSentences } from "../src/sentences";

describe("splitSentences", () => {
  it("splits on . ! ? followed by whitespace", () => {
    expect(splitSentences("One. Two! Three? Four.")).toEqual([
      "One.",
      "Two!",
      "Three?",
      "Four.",
    ]);
  });

  it("returns empty array for empty or whitespace-only input", () => {
    expect(splitSentences("")).toEqual([]);
    expect(splitSentences("   ")).toEqual([]);
  });

  it("keeps text without terminal punctuation as one sentence", () => {
    expect(splitSentences("no punctuation here")).toEqual([
      "no punctuation here",
    ]);
  });

  it("keeps trailing text after last break", () => {
    expect(splitSentences("Done. And then some")).toEqual([
      "Done.",
      "And then some",
    ]);
  });

  it("does not split on decimal points", () => {
    expect(splitSentences("Pi is 3.14 exactly. Next.")).toEqual([
      "Pi is 3.14 exactly.",
      "Next.",
    ]);
  });

  it("does not split after common abbreviations", () => {
    expect(splitSentences("Mr. Smith met Dr. Jones. They talked.")).toEqual([
      "Mr. Smith met Dr. Jones.",
      "They talked.",
    ]);
  });

  it("handles dotted abbreviations like e.g. and i.e.", () => {
    expect(splitSentences("Use fruit, e.g. apples. Simple.")).toEqual([
      "Use fruit, e.g. apples.",
      "Simple.",
    ]);
  });

  it("does not split mid-word punctuation like URLs", () => {
    expect(splitSentences("Visit example.com now. Bye.")).toEqual([
      "Visit example.com now.",
      "Bye.",
    ]);
  });

  it("splits at end of string without trailing whitespace", () => {
    expect(splitSentences("Only one sentence.")).toEqual([
      "Only one sentence.",
    ]);
  });

  it("handles newlines as whitespace after break", () => {
    expect(splitSentences("First.\nSecond.")).toEqual(["First.", "Second."]);
  });
});
