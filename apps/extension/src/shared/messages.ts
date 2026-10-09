import type { ReaderState, Speed } from "@sr/core";

/** Every message passed between popup, background, content script and offscreen doc. */
export type Message =
  | { type: "sr:open" } // popup -> content: open the reader overlay
  | { type: "sr:sentences"; texts: string[] } // content -> offscreen (via background)
  | { type: "sr:control"; action: "toggle" | "next" | "prev" | "stop" }
  | { type: "sr:seek"; index: number }
  | { type: "sr:get-state" }
  | { type: "sr:state"; state: ReaderState } // offscreen -> everyone
  | { type: "sr:speed"; speed: Speed }; // popup -> offscreen (it can't read chrome.storage)
