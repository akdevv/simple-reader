"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Article } from "@/lib/types/article";
import { Navbar } from "@/components/shared/navbar";
import { ArticleCard } from "@/components/articles/article-card";
import { EmptyState } from "@/components/articles/empty-state";
import { Pagination } from "@/components/articles/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LuSearch } from "react-icons/lu";
import axios from "axios";

type SortBy = "new" | "old";
type FilterStatus = "" | "read" | "unread" | "favourite" | "not-favourite";

export default function ArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("new");
  const [filter, setFilter] = useState<FilterStatus>("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    try {
      let url: string;
      if (searchQuery.trim()) {
        const params = new URLSearchParams({
          q: searchQuery.trim(),
          page: page.toString(),
          limit: "12",
        });
        url = `/api/articles/search?${params}`;
      } else {
        const params = new URLSearchParams({
          page: page.toString(),
          limit: "12",
          sort_by: sortBy,
        });
        if (filter) params.set("status", filter);
        url = `/api/articles?${params}`;
      }

      const res = await axios.get(url);
      setArticles(res.data.data);
      setTotalPages(res.data.pagination.totalPages);
    } catch {
      setArticles([]);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [searchQuery, sortBy, filter, page]);

  useEffect(() => {
    fetchArticles();
  }, [fetchArticles]);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(1);
    }, 300);
  };

  const handleSortChange = (value: string) => {
    setSortBy(value as SortBy);
    setPage(1);
  };

  const handleFilterChange = (value: string) => {
    setFilter(value as FilterStatus);
    setPage(1);
  };

  const handleArticleUpdate = (id: string, updates: Partial<Article>) => {
    setArticles((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a))
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="mx-auto max-w-6xl px-6 py-12 sm:px-10">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Your Articles
          </h1>
          <p className="mt-1 text-sm text-muted-foreground/60">
            All your saved articles in one place
          </p>
        </div>

        {/* Search + Filters */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <LuSearch className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/40" />
            <Input
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search by title..."
              className="h-10 pl-10 bg-card/50 border-border/50"
            />
          </div>

          <div className="flex gap-2">
            <Select value={sortBy} onValueChange={handleSortChange}>
              <SelectTrigger className="h-10 w-[130px] bg-card/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">Newest first</SelectItem>
                <SelectItem value="old">Oldest first</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filter || "all"} onValueChange={(v) => handleFilterChange(v === "all" ? "" : v)}>
              <SelectTrigger className="h-10 w-[150px] bg-card/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All articles</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
                <SelectItem value="favourite">Favourites</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[...Array(6)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/50 bg-card/50 p-5 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-16" />
                  <div className="flex gap-1">
                    <Skeleton className="size-6 rounded-md" />
                    <Skeleton className="size-6 rounded-md" />
                  </div>
                </div>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-3/4" />
                <div className="space-y-1.5 pt-1">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3.5 w-2/3" />
                </div>
                <div className="flex items-center gap-3 pt-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : articles.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {articles.map((article) => (
              <ArticleCard
                key={article.id}
                article={article}
                onUpdate={handleArticleUpdate}
              />
            ))}
          </div>
        )}

        <Pagination page={page} totalPages={totalPages} onChange={setPage} />
      </main>
    </div>
  );
}
