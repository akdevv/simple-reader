/**
 * Self-check for sentence extraction + DOM Range mapping.
 * Run: pnpm exec tsx extension/test/extract.test.ts (from repo root)
 */
import assert from "node:assert";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><body></body>");
Object.assign(globalThis, {
  window: dom.window,
  document: dom.window.document,
  NodeFilter: dom.window.NodeFilter,
});

const normalize = (s: string) => s.replace(/\s+/g, " ").trim();

function block(html: string): Element {
  const el = dom.window.document.createElement("p");
  el.innerHTML = html;
  dom.window.document.body.appendChild(el);
  return el;
}

async function main() {
const { extractFromBlock } = await import("../src/content");

// Basic split across inline elements
{
  const results = extractFromBlock(
    block("Dr. Smith went home. It was <b>very</b> late!"),
  );
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].text, "Dr. Smith went home.");
  assert.strictEqual(results[1].text, "It was very late!");
  // Range must point at the exact in-page text (whitespace aside)
  assert.strictEqual(normalize(results[1].range.toString()), results[1].text);
}

// Messy whitespace: ranges still land on the right characters
{
  const results = extractFromBlock(
    block("Hello   world.\n   Next sentence here."),
  );
  assert.strictEqual(results.length, 2);
  assert.strictEqual(results[0].text, "Hello world.");
  assert.strictEqual(normalize(results[0].range.toString()), "Hello world.");
  assert.strictEqual(
    normalize(results[1].range.toString()),
    "Next sentence here.",
  );
}

// Empty / whitespace-only blocks produce nothing
{
  assert.strictEqual(extractFromBlock(block("   \n  ")).length, 0);
}

console.log("extract.test.ts: all checks passed");
}

main();
