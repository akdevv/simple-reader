"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Article,
  ArticleSection,
  VideoSection,
  TableSection,
  CodeSection,
} from "@/lib/types/article";
import { codeToHtml } from "shiki";
import { CgSpinnerAlt } from "react-icons/cg";
import {
  LuExternalLink,
  LuTriangleAlert,
  LuArrowLeft,
  LuFileText,
  LuImageOff,
  LuRotateCw,
  LuCheck,
  LuCopy,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import axios from "axios";

// ─── Main Page ──────────────────────────────────────────────────────────────

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
    try {
      await axios.patch(`/api/article/${id}`, {});
    } catch {
      // ignore
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

  useEffect(() => {
    if (!article || article.status !== "PROCESSING") return;
    const interval = setInterval(fetchArticle, 3000);
    return () => clearInterval(interval);
  }, [article?.status, fetchArticle]);

  const goBack = () => router.push("/articles");

  if (loading) return <ArticleSkeleton />;

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

  const sections = (article.sections as ArticleSection[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <article className="article-content mx-auto max-w-[720px] px-5 py-14 sm:px-8">
        {/* Back nav */}
        <button
          onClick={goBack}
          className="group mb-10 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <LuArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to articles
        </button>

        {/* Header */}
        <header className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-[2.5rem] sm:leading-[1.15] mb-5">
            {article.title || "Untitled"}
          </h1>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-muted-foreground/80 uppercase tracking-wide font-medium">
            <time dateTime={new Date(article.createdAt).toISOString()}>
              {new Date(article.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
              })}
            </time>

            {article.siteName && (
              <>
                <span className="text-border">·</span>
                <span>{article.siteName}</span>
              </>
            )}

            {article.sourceType === "url" && article.url ? (
              <>
                <span className="text-border">·</span>
                <a
                  href={article.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 transition-colors hover:text-primary"
                >
                  Source
                  <LuExternalLink className="size-3" />
                </a>
              </>
            ) : article.sourceType === "pasted" ? (
              <>
                <span className="text-border">·</span>
                <span className="inline-flex items-center gap-1">
                  <LuFileText className="size-3" />
                  Pasted
                </span>
              </>
            ) : null}
          </div>

          {/* Divider line */}
          <div className="mt-8 h-px bg-gradient-to-r from-border/80 via-border/40 to-transparent" />
        </header>

        {/* Content */}
        <div className="article-body">
          {sections.length > 0 ? (
            sections.map((section, i) => (
              <SectionRenderer key={i} section={section} />
            ))
          ) : (
            <p className="text-muted-foreground">No content available.</p>
          )}
        </div>

        {/* Footer divider */}
        <div className="mt-16 h-px bg-gradient-to-r from-transparent via-border/60 to-transparent" />
        <div className="mt-6 text-center">
          <button
            onClick={goBack}
            className="text-sm text-muted-foreground/60 transition-colors hover:text-muted-foreground"
          >
            ← Back to articles
          </button>
        </div>
      </article>
    </div>
  );
}

// ─── Section Renderer ───────────────────────────────────────────────────────

function SectionRenderer({ section }: { section: ArticleSection }) {
  switch (section.type) {
    case "heading": {
      const level = section.level || 2;
      const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
      const styles: Record<number, string> = {
        1: "text-[1.85rem] sm:text-3xl font-bold tracking-tight mt-14 mb-5",
        2: "text-[1.55rem] sm:text-2xl font-semibold tracking-tight mt-12 mb-4",
        3: "text-xl sm:text-[1.35rem] font-semibold mt-10 mb-3",
        4: "text-lg font-semibold mt-8 mb-3",
        5: "text-base font-semibold mt-6 mb-2",
        6: "text-sm font-semibold uppercase tracking-widest text-muted-foreground mt-6 mb-2",
      };
      return (
        <Tag className={`${styles[level]} text-foreground`}>
          {section.content}
        </Tag>
      );
    }

    case "paragraph":
      return (
        <p className="mb-6 text-[17px] leading-[1.8] text-foreground/85">
          <RichText text={section.content} />
        </p>
      );

    case "image":
      return <ArticleImage section={section} />;

    case "video":
      return <ArticleVideo section={section} />;

    case "blockquote":
      return (
        <blockquote className="my-8 relative pl-6 before:absolute before:left-0 before:top-0 before:bottom-0 before:w-[3px] before:rounded-full before:bg-primary/40">
          <p className="text-[17px] leading-[1.75] text-foreground/70 italic">
            <RichText text={section.content} />
          </p>
        </blockquote>
      );

    case "code":
      return <CodeBlock section={section} />;

    case "list": {
      const ListTag = section.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={`my-6 space-y-2.5 text-[17px] leading-[1.75] text-foreground/85 ${
            section.ordered
              ? "list-decimal pl-6 marker:text-muted-foreground/50 marker:font-mono marker:text-sm"
              : "pl-6 list-disc marker:text-primary/40"
          }`}
        >
          {section.items.map((item, j) => (
            <li key={j} className="pl-1">
              <RichText text={item} />
            </li>
          ))}
        </ListTag>
      );
    }

    case "table":
      return <ArticleTable section={section} />;

    default:
      return null;
  }
}

// ─── Code Block with Syntax Highlighting ────────────────────────────────────

function CodeBlock({ section }: { section: CodeSection }) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function highlight() {
      try {
        const html = await codeToHtml(section.content, {
          lang: section.language || "text",
          theme: "vitesse-dark",
        });
        if (!cancelled) setHighlightedHtml(html);
      } catch {
        // Fallback: if language isn't supported, try plain text
        try {
          const html = await codeToHtml(section.content, {
            lang: "text",
            theme: "vitesse-dark",
          });
          if (!cancelled) setHighlightedHtml(html);
        } catch {
          // Give up on highlighting
        }
      }
    }

    highlight();
    return () => {
      cancelled = true;
    };
  }, [section.content, section.language]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(section.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  };

  return (
    <div className="code-block group my-8 relative rounded-xl border border-border/40 bg-[#121212] overflow-hidden">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/[0.06]">
        <span className="text-[11px] font-mono uppercase tracking-wider text-white/25 select-none">
          {section.language || "code"}
        </span>
        <button
          onClick={handleCopy}
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-white/30 hover:text-white/60 transition-colors"
          aria-label="Copy code"
        >
          {copied ? (
            <>
              <LuCheck className="size-3" />
              <span>Copied</span>
            </>
          ) : (
            <>
              <LuCopy className="size-3" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Code content */}
      {highlightedHtml ? (
        <div
          className="code-highlight overflow-x-auto px-5 py-4 text-[13px] leading-[1.7] [&_pre]:!bg-transparent [&_pre]:!m-0 [&_pre]:!p-0 [&_code]:!bg-transparent"
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <pre className="overflow-x-auto px-5 py-4 text-[13px] leading-[1.7] font-mono text-white/70">
          <code>{section.content}</code>
        </pre>
      )}
    </div>
  );
}

// ─── Rich Text (inline formatting) ─────────────────────────────────────────

/**
 * Parses markdown-style inline formatting:
 * - `[text](url)` → clickable link
 * - `**text**` → bold
 * - `*text*` → italic
 * - `` `code` `` → inline code
 * - `~~text~~` → strikethrough
 */
function RichText({ text }: { text: string }) {
  // Combined regex for all inline tokens
  // Order matters: bold before italic, links first to avoid conflicts
  const TOKEN_REGEX =
    /\[([^\]]+)\]\(([^)]+)\)|\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`|~~(.+?)~~/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let keyCounter = 0;

  while ((match = TOKEN_REGEX.exec(text)) !== null) {
    // Plain text before this token
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const key = keyCounter++;

    if (match[1] !== undefined && match[2] !== undefined) {
      // Link: [text](url)
      parts.push(
        <a
          key={key}
          href={match[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline decoration-primary/25 underline-offset-[3px] transition-all hover:decoration-primary/60"
        >
          {match[1]}
        </a>
      );
    } else if (match[3] !== undefined) {
      // Bold: **text**
      parts.push(
        <strong key={key} className="font-semibold text-foreground">
          {match[3]}
        </strong>
      );
    } else if (match[4] !== undefined) {
      // Italic: *text*
      parts.push(
        <em key={key} className="italic">
          {match[4]}
        </em>
      );
    } else if (match[5] !== undefined) {
      // Inline code: `code`
      parts.push(
        <code
          key={key}
          className="inline-block rounded-md bg-muted/60 border border-border/40 px-1.5 py-0.5 font-mono text-[0.85em] text-primary/90"
        >
          {match[5]}
        </code>
      );
    } else if (match[6] !== undefined) {
      // Strikethrough: ~~text~~
      parts.push(
        <del key={key} className="text-muted-foreground line-through">
          {match[6]}
        </del>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? <>{parts}</> : <>{text}</>;
}

// ─── Table ──────────────────────────────────────────────────────────────────

function ArticleTable({ section }: { section: TableSection }) {
  return (
    <div className="my-8 overflow-hidden rounded-xl border border-border/50 bg-card/30">
      <div className="overflow-x-auto">
        <table className="w-full text-[14px]">
          {section.caption && (
            <caption className="px-5 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground/60 border-b border-border/30">
              {section.caption}
            </caption>
          )}
          {section.headers.length > 0 && (
            <thead>
              <tr className="border-b border-border/50">
                {section.headers.map((header, i) => (
                  <th
                    key={i}
                    className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
                    <RichText text={header} />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-border/30">
            {section.rows.map((row, i) => (
              <tr key={i} className="transition-colors hover:bg-muted/10">
                {row.map((cell, j) => (
                  <td
                    key={j}
                    className="px-5 py-3 text-foreground/80 leading-relaxed whitespace-nowrap first:whitespace-normal"
                  >
                    <RichText text={cell} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Image ──────────────────────────────────────────────────────────────────

function ArticleImage({
  section,
}: {
  section: { url: string; alt?: string; caption?: string };
}) {
  const [errored, setErrored] = useState(false);

  if (errored) {
    return (
      <div className="my-8 flex items-center justify-center rounded-xl border border-border/30 bg-muted/10 py-16">
        <div className="flex flex-col items-center gap-2 text-muted-foreground/40">
          <LuImageOff className="size-8" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Image unavailable
          </span>
        </div>
      </div>
    );
  }

  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-xl">
        <img
          src={section.url}
          alt={section.alt || ""}
          loading="lazy"
          className="w-full transition-transform duration-500 hover:scale-[1.02]"
          onError={() => setErrored(true)}
        />
      </div>
      {section.caption && (
        <figcaption className="mt-3 text-center text-[13px] text-muted-foreground/60 italic">
          {section.caption}
        </figcaption>
      )}
    </figure>
  );
}

// ─── Video ──────────────────────────────────────────────────────────────────

function ArticleVideo({ section }: { section: VideoSection }) {
  if (section.provider === "youtube" || section.provider === "vimeo") {
    return (
      <div className="my-8 aspect-video overflow-hidden rounded-xl border border-border/30">
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
      className="my-8 w-full rounded-xl"
      preload="metadata"
    />
  );
}

// ─── Skeleton / Status ──────────────────────────────────────────────────────

function ArticleSkeleton() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[720px] px-5 py-14 sm:px-8">
        <Skeleton className="mb-10 h-4 w-28" />

        <div className="mb-12 space-y-5">
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-3/4" />
          </div>
          <div className="flex items-center gap-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-14" />
          </div>
          <Skeleton className="h-px w-full" />
        </div>

        <div className="space-y-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="space-y-3">
              <Skeleton className="h-[17px] w-full" />
              <Skeleton className="h-[17px] w-full" />
              <Skeleton className="h-[17px] w-5/6" />
            </div>
          ))}
          <Skeleton className="h-7 w-2/5 mt-10" />
          {[...Array(3)].map((_, i) => (
            <div key={`b${i}`} className="space-y-3">
              <Skeleton className="h-[17px] w-full" />
              <Skeleton className="h-[17px] w-full" />
              <Skeleton className="h-[17px] w-4/5" />
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
