"use client";

import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { LuArrowUpRight, LuLink, LuFileText } from "react-icons/lu";
import { CgSpinnerAlt } from "react-icons/cg";
import { Button } from "@/components/ui/button";
import axios from "axios";

function isHttpsUrl(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.startsWith("https://")) return false;
  try {
    new URL(trimmed);
    return true;
  } catch {
    return false;
  }
}

export function ArticleLinkInput() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isUrl = input.trim() ? isHttpsUrl(input) : null;

  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setError("");
    requestAnimationFrame(adjustHeight);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = input.trim();
    if (!trimmed) {
      setError("Please enter a URL or paste some text");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const body = isHttpsUrl(trimmed)
        ? { url: trimmed }
        : { content: trimmed };

      const response = await axios.post<{ data: { id: string } }>(
        "/api/article",
        body
      );

      if (response.status === 200 && response.data.data.id) {
        router.push(`/articles/${response.data.data.id}`);
      }

      setInput("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
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
      <div className="flex flex-row items-end gap-3">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSubmit(e);
            }
          }}
          placeholder="Paste a link or text…"
          rows={1}
          disabled={loading}
          className="h-13 min-h-13 max-h-[200px] flex-1 resize-none overflow-y-auto rounded-xl border border-border/80 bg-card/80 px-5 py-3.5 text-base shadow-md backdrop-blur-sm transition-all duration-300 placeholder:text-muted-foreground/40 focus-visible:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-50"
          aria-label="Article URL or text content"
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
      <div className="flex items-center justify-between pl-1">
        {error ? (
          <p className="text-sm text-red-400/80">{error}</p>
        ) : isUrl !== null ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground/60">
            {isUrl ? (
              <>
                <LuLink className="size-3" />
                Link detected
              </>
            ) : (
              <>
                <LuFileText className="size-3" />
                Text detected
              </>
            )}
          </p>
        ) : (
          <span />
        )}
      </div>
    </form>
  );
}
