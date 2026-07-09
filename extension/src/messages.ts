/** Messages passed between popup, background, content script and offscreen doc. */

import type { Settings } from "./settings";

export type Phase =
  | "idle"
  | "extracting"
  | "loading-model"
  | "generating"
  | "playing"
  | "paused"
  | "done"
  | "error";

export interface ReaderState {
  phase: Phase;
  /** 0-100, model download progress */
  modelProgress: number;
  /** sentences with audio ready */
  generated: number;
  total: number;
  /** currently playing sentence */
  index: number;
  error?: string;
}

export const IDLE_STATE: ReaderState = {
  phase: "idle",
  modelProgress: 0,
  generated: 0,
  total: 0,
  index: -1,
};

export type Message =
  | { type: "sr:start" } // popup -> background
  | { type: "sr:extract" } // background -> content
  | { type: "sr:sentences"; texts: string[]; pageKey: string } // content -> background
  | { type: "sr:generate"; texts: string[]; pageKey: string } // background -> offscreen
  | { type: "sr:control"; action: "toggle" | "next" | "prev" | "stop" } // popup/background -> offscreen
  | { type: "sr:get-state" } // popup -> offscreen
  | { type: "sr:state"; state: ReaderState } // offscreen -> everyone
  | { type: "sr:highlight"; index: number } // background -> content
  | { type: "sr:clear" } // background -> content
  // popup -> offscreen; offscreen docs can't read chrome.storage themselves
  | { type: "sr:settings"; settings: Settings }
  // offscreen -> background (which responds with stored settings)
  | { type: "sr:get-settings" };
