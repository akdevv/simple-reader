"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LuArrowUpRight } from "react-icons/lu";
import { CgSpinnerAlt } from "react-icons/cg";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Article } from "@/lib/types/article";
import axios from "axios";

export function ArticleLinkInput() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!url.trim()) {
      setError("Please enter a URL");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await axios.post<{ data: Article }>("/api/article", { url });
      
      if (response.status === 200 && response.data.data.id) {
        router.push(`/r/${response.data.data.id}`);
      }
      
      setUrl("");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        setError("Something went wrong");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex flex-row items-center gap-3">
        <Input
          type="url"
          placeholder="Paste an article link…"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            setError("");
          }}
          disabled={loading}
          className="h-13 flex-1 rounded-xl border border-border/80 bg-card/80 px-5 text-base shadow-md backdrop-blur-sm transition-all duration-300 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50"
          aria-label="Article URL"
        />
        <Button
          type="submit"
          size="icon"
          disabled={loading}
          className="size-12 shrink-0 rounded-full shadow-md shadow-primary/15 transition-shadow hover:shadow-lg hover:shadow-primary/25 disabled:opacity-50"
          aria-label="Read now"
        >
          {loading ? (
            <CgSpinnerAlt className="size-5 animate-spin" />
          ) : (
            <LuArrowUpRight className="size-5" />
          )}
        </Button>
      </div>
      {error && <p className="text-sm text-red-400/80 pl-1">{error}</p>}
    </form>
  );
}
