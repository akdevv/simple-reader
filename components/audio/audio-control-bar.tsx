"use client";

import {
  LuPlay,
  LuPause,
  LuSkipBack,
  LuSkipForward,
  LuChevronDown,
} from "react-icons/lu";

const slideUpKeyframes = `
  @keyframes audio-slide-up {
    from { transform: translateY(24px); opacity: 0; }
    to { transform: translateY(0); opacity: 1; }
  }
`;

interface AudioControlBarProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onToggle: () => void;
  onNext: () => void;
  onPrev: () => void;
  onClose: () => void;
}

function formatTime(seconds: number): string {
  if (!seconds || !isFinite(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioControlBar({
  isPlaying,
  currentTime,
  duration,
  onToggle,
  onNext,
  onPrev,
  onClose,
}: AudioControlBarProps) {
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: slideUpKeyframes }} />
      <div className="fixed inset-x-0 bottom-0 z-50 flex justify-center pb-5">
        <div
          className="w-full max-w-[min(calc(100vw-2rem),420px)] px-4"
          style={{
            animation: "audio-slide-up 0.35s cubic-bezier(0.2, 0.9, 0.3, 1) both",
          }}
        >
          <div className="w-fit min-w-[280px] flex flex-col items-center gap-3 rounded-[22px] bg-muted/95 backdrop-blur-2xl py-3 px-4">
            {/* Top row: elapsed (left), progress bar (middle), total (right) */}
            <div className="w-full flex items-center gap-3">
              <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 w-10 text-left">
                {formatTime(currentTime)}
              </span>
              <div className="flex-1 relative flex items-center min-h-[24px] py-1.5">
                {/* Track — Material 3 style: full-width pill, inactive segment */}
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full h-1.5 rounded-full bg-black/8 dark:bg-white/10" />
                </div>
                {/* Active segment — primary, rounded to match track */}
                <div
                  className="absolute left-0 h-1.5 rounded-full bg-primary transition-[width] duration-200 ease-out"
                  style={{ width: `${progress}%` }}
                />
                {/* Thumb — elevated circle, primary with surface ring (Material slider thumb) */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-primary ring-[3px] ring-muted shadow-[0_1px_2px_rgba(0,0,0,0.08)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)] transition-[left] duration-200 ease-out pointer-events-none"
                  style={{ left: `${progress}%` }}
                  aria-hidden
                />
              </div>
              <span className="text-xs font-medium text-muted-foreground tabular-nums shrink-0 w-12 text-right">
                {formatTime(duration)}
              </span>
            </div>

            {/* Main row: three separate circular buttons */}
            <div className="flex items-center justify-center gap-2">
              <button
                onClick={onPrev}
                className="flex items-center justify-center size-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/90 active:scale-95 transition-all duration-150"
                aria-label="Previous sentence"
              >
                <LuSkipBack className="size-4" />
              </button>

              <button
                onClick={onToggle}
                className="flex items-center justify-center size-11 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.95] transition-all duration-150"
                aria-label={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? (
                  <LuPause className="size-5" />
                ) : (
                  <LuPlay className="size-5 ml-0.5" />
                )}
              </button>

              <button
                onClick={onNext}
                className="flex items-center justify-center size-9 rounded-full bg-secondary text-secondary-foreground hover:bg-secondary/90 active:scale-95 transition-all duration-150"
                aria-label="Next sentence"
              >
                <LuSkipForward className="size-4" />
              </button>
            </div>

            {/* Bottom row: close pill */}
            <div className="flex items-center justify-center w-full">
              <button
                type="button"
                onClick={onClose}
                className="flex items-center justify-center gap-1 rounded-full h-7 pl-2.5 pr-2.5 bg-background/60 hover:bg-background/80 text-muted-foreground hover:text-foreground active:scale-[0.98] transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-muted"
                aria-label="Close audio player"
              >
                <LuChevronDown className="size-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
