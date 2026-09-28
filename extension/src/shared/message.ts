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
  modelProgress: number; // model download progress
  generated: number; // sentences with audio ready
  total: number;
  index: number; // curr playing sentence
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
  | { type: "sr:control"; action: "toggle" | "next" | "prev" | "stop" } // popup/content -> offscreen
  | { type: "sr:seek"; index: number } // content (sentence click) -> offscreen
  | { type: "sr:get-state" } // popup -> offscreen
  | { type: "sr:state"; state: ReaderState } // offscreen -> everyone
  | { type: "sr:highlight"; index: number } // background -> content
  | { type: "sr:clear" } // background -> content
  // popup -> offscreen; offscreen docs can't read chrome.storage themselves
  | { type: "sr:settings"; settings: Settings }
  // offscreen -> background (which responds with stored settings)
  | { type: "sr:get-settings" };
