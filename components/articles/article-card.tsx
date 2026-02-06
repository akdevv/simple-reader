"use client";

import { useState } from "react";
import Link from "next/link";
import { Article, ReadStatus } from "@/lib/types/article";
import {
  LuHeart,
  LuLink,
  LuFileText,
  LuClock,
  LuBookCheck,
  LuBookOpen,
} from "react-icons/lu";
import { CgSpinnerAlt } from "react-icons/cg";
import { Badge } from "@/components/ui/badge";
import axios from "axios";

interface ArticleCardProps {
  article: Article;
  onUpdate: (id: string, updates: Partial<Article>) => void;
}

export function ArticleCard({ article, onUpdate }: ArticleCardProps) {
  const [favLoading, setFavLoading] = useState(false);
  const [readLoading, setReadLoading] = useState(false);

  const toggleFavourite = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavLoading(true);
    try {
      const res = await axios.patch(`/api/article/${article.id}`, {
        isFavourite: !article.isFavourite,
      });
      onUpdate(article.id, { isFavourite: res.data.data.isFavourite });
    } catch {
      // silently fail
    } finally {
      setFavLoading(false);
    }
  };

  const toggleReadStatus = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setReadLoading(true);
    const newStatus: ReadStatus =
      article.readStatus === "READ" ? "UNREAD" : "READ";
    try {
      const res = await axios.patch(`/api/article/${article.id}`, {
        readStatus: newStatus,
      });
      onUpdate(article.id, { readStatus: res.data.data.readStatus });
    } catch {
      // silently fail
    } finally {
      setReadLoading(false);
    }
  };

  const hostname = article.url
    ? (() => {
        try {
          return new URL(article.url).hostname.replace(/^www\./, "");
        } catch {
          return null;
        }
      })()
    : null;

  const statusColor: Record<string, string> = {
    READY: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
    PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    PROCESSING: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    ERROR: "bg-red-500/15 text-red-400 border-red-500/20",
  };

  return (
    <Link href={`/articles/${article.id}`} className="group block">
      <div className="relative flex h-full flex-col rounded-2xl border border-border/50 bg-card/50 p-5 backdrop-blur-sm transition-all duration-300 hover:border-border/80 hover:shadow-lg hover:shadow-black/5">
        {/* Top row: status + actions */}
        <div className="mb-3 flex items-center justify-between">
          <Badge
            variant="outline"
            className={`text-[10px] font-medium ${statusColor[article.status] || ""}`}
          >
            {article.status}
          </Badge>

          <div className="flex items-center gap-1">
            <button
              onClick={toggleReadStatus}
              disabled={readLoading}
              className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50"
              title={
                article.readStatus === "READ" ? "Mark as unread" : "Mark as read"
              }
            >
              {readLoading ? (
                <CgSpinnerAlt className="size-3.5 animate-spin" />
              ) : article.readStatus === "READ" ? (
                <LuBookCheck className="size-3.5 text-emerald-400" />
              ) : (
                <LuBookOpen className="size-3.5" />
              )}
            </button>

            <button
              onClick={toggleFavourite}
              disabled={favLoading}
              className="rounded-md p-1.5 text-muted-foreground/50 transition-colors hover:bg-muted/50 hover:text-red-400 disabled:opacity-50"
              title={article.isFavourite ? "Remove from favourites" : "Add to favourites"}
            >
              {favLoading ? (
                <CgSpinnerAlt className="size-3.5 animate-spin" />
              ) : (
                <LuHeart
                  className={`size-3.5 ${
                    article.isFavourite
                      ? "fill-red-400 text-red-400"
                      : ""
                  }`}
                />
              )}
            </button>
          </div>
        </div>

        {/* Title */}
        <h3 className="mb-2 text-base font-semibold leading-snug text-foreground line-clamp-2 group-hover:text-primary transition-colors">
          {article.title || "Untitled"}
        </h3>

        {/* Excerpt */}
        {article.excerpt && (
          <p className="mb-4 text-sm leading-relaxed text-muted-foreground/70 line-clamp-3">
            {article.excerpt}
          </p>
        )}

        {/* Footer */}
        <div className="mt-auto flex items-center gap-3 text-xs text-muted-foreground/50">
          <span className="inline-flex items-center gap-1">
            {article.sourceType === "url" ? (
              <>
                <LuLink className="size-3" />
                {hostname || "Link"}
              </>
            ) : (
              <>
                <LuFileText className="size-3" />
                Pasted
              </>
            )}
          </span>

          <span className="text-border/50">|</span>

          <span className="inline-flex items-center gap-1">
            <LuClock className="size-3" />
            {new Date(article.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
      </div>
    </Link>
  );
}
