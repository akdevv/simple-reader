"use client";

import { LuPlay, LuPause, LuRotateCcw, LuRotateCw } from "react-icons/lu";
import { cn } from "@/lib/utils";

/** Props for the floating audio control bar (play/pause, skip, time, close). */
interface AudioControlBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

/** Formats seconds as "M:SS" (e.g. 90 → "1:30"). Handles invalid/zero safely. */
function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const timeLabelClass =
  "shrink-0 w-9 text-[11px] text-muted-foreground font-mono tabular-nums";

const secondaryButtonClass =
  "flex items-center justify-center size-12 min-w-[48px] rounded-[24px] bg-secondary-foreground text-secondary active:rounded-[8px] active:bg-secondary-foreground/90 transition-[border-radius,background-color,color] duration-200 ease-out";

export function AudioControlBar({
  isPlaying,
  currentTime,
  duration,
  onToggle,
  onNext,
  onPrev,
  onClose,
}: AudioControlBarProps) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-4">
      <div className={cn("w-fit px-3", "animate-audio-slide-up")}>
        <div className="w-fit flex flex-col items-center gap-2 rounded-[28px] border border-border/40 bg-muted/95 shadow-lg shadow-black/5 backdrop-blur-2xl py-2 px-3.5 pb-2.5">
          {/* Drag handle: visually a small pill; click closes the player. */}
          <button
            type="button"
            onClick={onClose}
            className="flex items-center justify-center w-7 h-1 rounded-full bg-muted-foreground/40 hover:bg-muted-foreground/55 cursor-grab active:scale-[0.96] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
            aria-label="Close audio player"
          />

          {/* Layout: [elapsed time] [prev | play/pause | next] [total duration] */}
          <div className="flex items-center gap-2">
            <span className={cn(timeLabelClass, "text-left")}>
              {formatTime(currentTime)}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onPrev}
                className={secondaryButtonClass}
                aria-label="Rewind 5 seconds"
              >
                <LuRotateCcw className="size-4" />
              </button>

              <button
                type="button"
                onClick={onToggle}
                className={cn(
                  "flex items-center justify-center h-12 min-w-[96px] w-[96px] transition-[border-radius,background-color,color] duration-200 ease-out",
                  isPlaying
                    ? "rounded-[24px] bg-primary-foreground text-primary"
                    : "rounded-[8px] bg-primary text-primary-foreground",
                )}
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <LuPause className="size-4" />
                ) : (
                  <LuPlay className="size-4 ml-0.5" />
                )}
              </button>

              <button
                type="button"
                onClick={onNext}
                className={secondaryButtonClass}
                aria-label="Forward 5 seconds"
              >
                <LuRotateCw className="size-4" />
              </button>
            </div>
            <span className={cn(timeLabelClass, "text-right")}>
              {formatTime(duration)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
