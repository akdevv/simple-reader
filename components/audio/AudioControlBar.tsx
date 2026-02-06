"use client";

import {
  LuPlay,
  LuPause,
  LuSkipBack,
  LuSkipForward,
  LuX,
} from "react-icons/lu";

interface AudioControlBarProps {
  isPlaying: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

export function AudioControlBar({
  isPlaying,
  currentSentenceIndex,
  totalSentences,
  onToggle,
  onNext,
  onPrev,
  onClose,
}: AudioControlBarProps) {
  return (
    <div className="audio-bar-enter fixed bottom-0 inset-x-0 z-50 pointer-events-none">
      <div className="mx-auto max-w-[720px] px-5 sm:px-8">
        <div className="pointer-events-auto flex items-center justify-between rounded-t-2xl border border-b-0 border-border/30 bg-card/80 backdrop-blur-xl px-5 py-3 shadow-2xl">
          {/* Sentence counter */}
          <span className="text-xs font-mono text-muted-foreground/60 tabular-nums min-w-[60px]">
            {currentSentenceIndex + 1} / {totalSentences}
          </span>

          {/* Controls */}
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className="flex items-center justify-center size-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Previous sentence"
            >
              <LuSkipBack className="size-4" />
            </button>

            <button
              onClick={onToggle}
              className="flex items-center justify-center size-10 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <LuPause className="size-4" />
              ) : (
                <LuPlay className="size-4 ml-0.5" />
              )}
            </button>

            <button
              onClick={onNext}
              className="flex items-center justify-center size-9 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              aria-label="Next sentence"
            >
              <LuSkipForward className="size-4" />
            </button>
          </div>

          {/* Close button */}
          <div className="min-w-[60px] flex justify-end">
            <button
              onClick={onClose}
              className="flex items-center justify-center size-7 rounded-full text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/30 transition-colors"
              aria-label="Close audio player"
            >
              <LuX className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
