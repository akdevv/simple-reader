export type ArticleStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "ERROR"
  | "TTS_PROCESSING"
  | "TTS_READY";

export interface Article {
  id: string;
  userId: string;
  url: string;

  status: ArticleStatus;

  title: string | null;
  excerpt: string | null;
  siteName: string | null;

  sections: unknown;
  media: unknown;
  ttsAudio: unknown;

  createdAt: Date;
  updatedAt: Date;
}
