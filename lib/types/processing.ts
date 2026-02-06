import { ArticleSection, MediaItem } from "./article";

export interface ProcessingResult {
  title: string;
  excerpt: string;
  siteName: string | null;
  sections: ArticleSection[];
  media: MediaItem[];
  isPaywalled?: boolean;
  errorMessage?: string;
}
