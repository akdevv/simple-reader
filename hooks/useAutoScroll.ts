"use client";

import { useEffect, useRef } from "react";

const AUDIO_BAR_HEIGHT = 72;
const MARGIN = 80;

/**
 * Auto-scroll the active sentence into view when it goes off-screen.
 * Does NOT fight user scroll — only scrolls when element is actually off-screen.
 */
export function useAutoScroll(
  activeSentenceId: string | null,
  enabled: boolean,
) {
  const lastScrolledId = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !activeSentenceId) return;
    if (activeSentenceId === lastScrolledId.current) return;

    const el = document.querySelector(
      `[data-sentence-id="${activeSentenceId}"]`,
    );
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;

    const isAbove = rect.top < MARGIN;
    const isBelow = rect.bottom > viewportHeight - AUDIO_BAR_HEIGHT - MARGIN;

    if (isAbove || isBelow) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    lastScrolledId.current = activeSentenceId;
  }, [activeSentenceId, enabled]);
}
