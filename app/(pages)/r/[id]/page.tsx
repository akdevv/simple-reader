"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import { Article } from "@/lib/types/article";
import { CgSpinnerAlt } from "react-icons/cg";
import { LuRotateCw, LuExternalLink, LuTriangleAlert } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import axios from "axios";

export default function ArticlePage() {
  const { id } = useParams<{ id: string }>();
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
    } finally {
      setLoading(false);
    }
  }, [id]);

  const handleRetry = async () => {
    setLoading(true);
    setError("");
    try {
      await axios.post(`/api/article/${id}/process`);
    } catch {
      // process endpoint may fail, still try to fetch
    }
    await fetchArticle();
  };

  useEffect(() => {
    fetchArticle();
  }, [fetchArticle]);

  // Poll while PENDING or PROCESSING
  useEffect(() => {
    if (!article) return;
    if (article.status !== "PENDING" && article.status !== "PROCESSING") return;

    const interval = setInterval(fetchArticle, 3000);
    return () => clearInterval(interval);
  }, [article, fetchArticle]);

  if (loading) {
    return <StatusShell><LoadingState message="Loading article..." /></StatusShell>;
  }

  if (error) {
    return (
      <StatusShell>
        <ErrorState message={error} onRetry={handleRetry} />
      </StatusShell>
    );
  }

  if (!article) {
    return (
      <StatusShell>
        <ErrorState message="Article not found" onRetry={handleRetry} />
      </StatusShell>
    );
  }

  if (article.status === "PENDING" || article.status === "PROCESSING") {
    return (
      <StatusShell>
        <LoadingState
          message={
            article.status === "PENDING"
              ? "Waiting to process article..."
              : "Processing article..."
          }
        />
      </StatusShell>
    );
  }

  if (article.status === "ERROR") {
    return (
      <StatusShell>
        <ErrorState
          message={article.errorMessage || "Something went wrong while processing this article"}
          onRetry={handleRetry}
        />
      </StatusShell>
    );
  }

  // READY — render article content
  const sections = (article.sections as { type: string; content: string }[] | null) ?? [];

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <header className="mb-8 space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {article.title || "Untitled"}
          </h1>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={new Date(article.createdAt).toISOString()}>
              {new Date(article.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            <span>&middot;</span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 hover:text-primary transition-colors underline underline-offset-4"
            >
              View original
              <LuExternalLink className="size-3.5" />
            </a>
          </div>
        </header>

        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {sections.length > 0 ? (
            sections.map((section, i) => {
              if (section.type === "heading") {
                return (
                  <h2
                    key={i}
                    className="mt-8 mb-4 text-2xl font-semibold text-foreground"
                  >
                    {section.content}
                  </h2>
                );
              }
              return (
                <p
                  key={i}
                  className="mb-4 text-lg leading-relaxed text-foreground/90"
                >
                  {section.content}
                </p>
              );
            })
          ) : (
            <p className="text-muted-foreground">No content available.</p>
          )}
        </div>
      </article>
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

function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CgSpinnerAlt className="size-8 animate-spin text-primary" />
      <p className="text-lg text-muted-foreground">{message}</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center max-w-md">
      <LuTriangleAlert className="size-10 text-destructive" />
      <p className="text-lg text-foreground">{message}</p>
      <Button onClick={onRetry} variant="outline" className="gap-2">
        <LuRotateCw className="size-4" />
        Try again
      </Button>
    </div>
  );
}
