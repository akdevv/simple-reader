/** An extracted article, as stored by the web app and shown by the reader. */
export interface Article {
  url: string;
  title: string;
  byline: string | null;
  siteName: string | null;
  excerpt: string | null;
  publishedAt: string | null;
  /** Article body HTML. Untrusted until sanitized on the server. */
  html: string;
  /** Plain text of the body, used for search and categorizing. */
  text: string;
}

export type Phase =
  | "idle"
  | "loading-model"
  | "generating"
  | "playing"
  | "paused"
  | "done"
  | "error";

export interface ReaderState {
  phase: Phase;
  /** 0-100, voice model download progress */
  modelProgress: number;
  /** sentences with audio ready */
  generated: number;
  total: number;
  /** currently playing sentence, -1 when none */
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

/** Speed is the only audio setting. */
export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2] as const;
export type Speed = (typeof SPEEDS)[number];
