export type ArticleStatus =
  | "PENDING"
  | "PROCESSING"
  | "READY"
  | "ERROR"
  | "TTS_PROCESSING"
  | "TTS_READY";

export type SourceType = "url" | "pasted";
export type ReadStatus = "READ" | "UNREAD";

// --- Section types ---
export interface HeadingSection {
  type: "heading";
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  content: string;
}

export interface ParagraphSection {
  type: "paragraph";
  content: string;
}

export interface ImageSection {
  type: "image";
  url: string;
  alt?: string;
  caption?: string;
}

export interface VideoSection {
  type: "video";
  url: string;
  provider?: "youtube" | "vimeo" | "raw";
}

export interface BlockquoteSection {
  type: "blockquote";
  content: string;
}

export interface CodeSection {
  type: "code";
  content: string;
  language?: string;
}

export interface ListSection {
  type: "list";
  ordered: boolean;
  items: string[];
}

export type ArticleSection =
  | HeadingSection
  | ParagraphSection
  | ImageSection
  | VideoSection
  | BlockquoteSection
  | CodeSection
  | ListSection;

// --- Media types ---
export interface ImageMedia {
  type: "image";
  url: string;
  alt?: string;
}

export interface VideoMedia {
  type: "video";
  url: string;
  provider?: "youtube" | "vimeo" | "raw";
}

export type MediaItem = ImageMedia | VideoMedia;

// --- Article ---
export interface Article {
  id: string;
  userId: string;
  url: string | null;
  sourceType: SourceType;

  status: ArticleStatus;
  errorMessage: string | null;

  isFavourite: boolean;
  readStatus: ReadStatus;

  title: string | null;
  excerpt: string | null;
  siteName: string | null;

  sections: ArticleSection[] | null;
  media: MediaItem[] | null;
  ttsAudio: unknown;

  createdAt: Date;
  updatedAt: Date;
}

// --- Paginated response ---
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
