"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Article,
  ArticleSection,
  VideoSection,
  TableSection,
} from "@/lib/types/article";
import { CgSpinnerAlt } from "react-icons/cg";
import {
  LuExternalLink,
  LuTriangleAlert,
  LuArrowLeft,
  LuFileText,
  LuImageOff,
  LuRotateCw,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchArticle = useCallback(async () => {
    try {
      const res = await axios.get<{ data: Article }>(`/api/article/${id}`);
      setArticle(res.data.data);
      setError("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError("Article not found");
      } else {
        setError("Failed to load article");
      }
      setArticle(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const triggerProcess = useCallback(async () => {
    try {
      await axios.post(`/api/article/${id}/process`);
      return true;
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Failed to process article");
      }
      setArticle(null);
      setLoading(false);
      return false;
    }
  }, [id]);

  const retryProcess = useCallback(async () => {
    setError("");
    setLoading(true);
    // Reset status so processing can be re-triggered
    try {
      await axios.patch(`/api/article/${id}`, {});
    } catch {
      // ignore - we'll try processing anyway
    }
    const ok = await triggerProcess();
    if (ok) {
      await fetchArticle();
    }
  }, [id, triggerProcess, fetchArticle]);

  useEffect(() => {
    (async () => {
      await fetchArticle();
    })();
  }, [fetchArticle]);

  // When article is PENDING, trigger process and then poll
  useEffect(() => {
    if (!article || article.status !== "PENDING") return;

    let cancelled = false;

    (async () => {
      const ok = await triggerProcess();
      if (!ok || cancelled) return;
      await fetchArticle();
    })();

    return () => {
      cancelled = true;
    };
  }, [article?.status, triggerProcess, fetchArticle]);

  // Poll while PROCESSING
  useEffect(() => {
    if (!article || article.status !== "PROCESSING") return;

    const interval = setInterval(fetchArticle, 3000);
    return () => clearInterval(interval);
  }, [article?.status, fetchArticle]);

  const goBack = () => router.push("/articles");

  // Loading skeleton
  if (loading) {
    return <ArticleSkeleton />;
  }

  if (error && !article) {
    return (
      <StatusShell>
        <ErrorState message={error} onBack={goBack} />
      </StatusShell>
    );
  }

  if (!article) {
    return (
      <StatusShell>
        <ErrorState message="Article not found" onBack={goBack} />
      </StatusShell>
    );
  }

  // Article in ERROR state
  if (article.status === "ERROR") {
    return (
      <StatusShell>
        <div className="flex flex-col items-center gap-4 text-center max-w-md">
          <LuTriangleAlert className="size-10 text-destructive" />
          <p className="text-lg text-foreground">
            {article.errorMessage || "Failed to process article"}
          </p>
          <div className="flex gap-3">
            <Button onClick={goBack} variant="outline" className="gap-2">
              <LuArrowLeft className="size-4" />
              Go back
            </Button>
            {article.sourceType === "url" && (
              <Button onClick={retryProcess} className="gap-2">
                <LuRotateCw className="size-4" />
                Try again
              </Button>
            )}
          </div>
        </div>
      </StatusShell>
    );
  }

  if (article.status === "PENDING" || article.status === "PROCESSING") {
    return (
      <StatusShell>
        <ProcessingState
          message={
            article.status === "PENDING"
              ? "Waiting to process article..."
              : "Processing article..."
          }
        />
      </StatusShell>
    );
  }

  // READY — render article content
  const sections = (article.sections as ArticleSection[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-[680px] px-4 py-12 sm:px-6">
        {/* Back button */}
        <button
          onClick={goBack}
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LuArrowLeft className="size-3.5" />
          Back to articles
        </button>

        <header className="mb-10 space-y-4">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl leading-tight">
            {article.title || "Untitled"}
          </h1>

          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
            <time dateTime={new Date(article.createdAt).toISOString()}>
              {new Date(article.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>

            {article.siteName && (
              <>
                <span className="text-border">|</span>
                <span>{article.siteName}</span>
              </>
            )}

            {article.sourceType === "url" && article.url ? (
              <>
                <span className="text-border">|</span>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                >
                  View original
                  <LuExternalLink className="size-3" />
                </a>
              </>
            ) : article.sourceType === "pasted" ? (
              <>
                <span className="text-border">|</span>
                <span className="inline-flex items-center gap-1">
                  <LuFileText className="size-3" />
                  Pasted content
                </span>
              </>
            ) : null}
          </div>
        </header>

        <div className="space-y-1">
          {sections.length > 0 ? (
            sections.map((section, i) => renderSection(section, i))
          ) : (
            <p className="text-muted-foreground">No content available.</p>
          )}
        </div>
      </article>
    </div>
  );
}

function renderSection(section: ArticleSection, index: number) {
  switch (section.type) {
    case "heading": {
      const level = section.level || 2;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const sizeClasses: Record<number, string> = {
        1: "text-3xl font-bold",
        2: "text-2xl font-semibold",
        3: "text-xl font-semibold",
        4: "text-lg font-semibold",
        5: "text-base font-semibold",
        6: "text-sm font-semibold uppercase tracking-wide",
      };
      return (
        <Tag
          key={index}
          className={`mt-10 mb-4 ${sizeClasses[level]} text-foreground`}
        >
          {section.content}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p
          key={index}
          className="mb-5 text-[18px] leading-[1.75] text-foreground/90"
        >
          <RichText text={section.content} />
        </p>
      );

    case "image":
      return <ArticleImage key={index} section={section} />;

    case "video":
      return <ArticleVideo key={index} section={section} />;

    case "blockquote":
      return (
        <blockquote
          key={index}
          className="my-6 border-l-3 border-primary/30 pl-5 italic text-foreground/80 text-[17px] leading-[1.7]"
        >
          <RichText text={section.content} />
        </blockquote>
      );

    case "code":
      return (
        <pre
          key={index}
          className="my-6 overflow-x-auto rounded-lg bg-muted/40 p-4 font-mono text-sm leading-relaxed"
        >
          <code>{section.content}</code>
        </pre>
      );

    case "list": {
      const ListTag = section.ordered ? "ol" : "ul";
      return (
        <ListTag
          key={index}
          className={`my-5 ml-6 space-y-2 text-[17px] leading-[1.7] text-foreground/90 ${
            section.ordered ? "list-decimal" : "list-disc"
          }`}
        >
          {section.items.map((item, j) => (
            <li key={j}>
              <RichText text={item} />
            </li>
          ))}
        </ListTag>
      );
    }

    case "table":
      return <ArticleTable key={index} section={section} />;

    default:
      return null;
  }
}

/**
 * Parses markdown-style links `[text](url)` in a string and renders them
 * as clickable anchor elements. Everything else is rendered as plain text.
 */
function RichText({ text }: { text: string }) {
  const LINK_REGEX = /\[([^\]]+)\]\(([^)]+)\)/g;
  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = LINK_REGEX.exec(text)) !== null) {
    // Text before the link
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <a
        key={match.index}
        href={match[2]}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary underline decoration-primary/30 underline-offset-2 transition-colors hover:decoration-primary/60"
      >
        {match[1]}
      </a>
    );
    lastIndex = match.index + match[0].length;
  }

  // Remaining text after last link
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

function ArticleTable({ section }: { section: TableSection }) {
  return (
    <div className="my-6 overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full text-[15px]">
        {section.caption && (
          <caption className="px-4 py-2 text-sm text-muted-foreground text-left">
            {section.caption}
          </caption>
        )}
        {section.headers.length > 0 && (
          <thead>
            <tr className="border-b border-border/50 bg-muted/30">
              {section.headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-2.5 text-left text-sm font-semibold text-foreground"
                >
                  <RichText text={header} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {section.rows.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/30 last:border-b-0 transition-colors hover:bg-muted/20"
            >
              {row.map((cell, j) => (
                <td
                  key={j}
                  className="px-4 py-2.5 text-foreground/85 leading-relaxed"
                >
                  <RichText text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ArticleImage({
  section,
}: {
  section: { url: string; alt?: string; caption?: string };
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="my-6 flex items-center justify-center rounded-xl border border-border/50 bg-muted/20 py-12">
        <div className="flex flex-col items-center gap-2 text-muted-foreground/50">
          <LuImageOff className="size-8" />
          <span className="text-sm">Image unavailable</span>
        </div>
      </div>
    );
  }

  return (
    <figure className="my-6">
      <img
        src={section.url}
        alt={section.alt || ""}
        loading="lazy"
        className="w-full rounded-xl"
        onError={() => setErrored(true)}
      />
      {section.caption && (
        <figcaption className="mt-2 text-center text-sm text-muted-foreground">
          {section.caption}
        </figcaption>
      )}
    </figure>
  );
}

function ArticleVideo({ section }: { section: VideoSection }) {
  if (section.provider === "youtube" || section.provider === "vimeo") {
    return (
      <div className="my-6 aspect-video overflow-hidden rounded-xl">
        <iframe
          src={section.url}
          className="h-full w-full"
          allowFullScreen
          loading="lazy"
          title="Embedded video"
        />
      </div>
    );
  }

  return (
    <video
      src={section.url}
      controls
      className="my-6 w-full rounded-xl"
      preload="metadata"
    />
  );
}

function ArticleSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[680px] px-4 py-12 sm:px-6">
        {/* Back button skeleton */}
        <Skeleton className="mb-8 h-4 w-32" />

        {/* Title skeleton */}
        <div className="mb-10 space-y-4">
          <div className="space-y-3">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-3/4" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>

        {/* Content skeleton */}
        <div className="space-y-5">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
            </div>
          ))}
          <Skeleton className="h-6 w-2/5 mt-8" />
          {[...Array(4)].map((_, i) => (
            <div key={`b${i}`} className="space-y-2.5">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function StatusShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {children}
    </div>
  );
}

function ProcessingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CgSpinnerAlt className="size-8 animate-spin text-primary" />
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorState({
  message,
  onBack,
}: {
  message: string;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-md">
      <LuTriangleAlert className="size-10 text-destructive" />
      <p className="text-lg text-foreground">{message}</p>
      <Button onClick={onBack} variant="outline" className="gap-2">
        <LuArrowLeft className="size-4" />
        Go back
      </Button>
    </div>
  );
}
