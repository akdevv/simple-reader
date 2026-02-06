"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { AudioAlignment } from "@/lib/types/audio";

export interface UseAudioPlaybackReturn {
  isPlaying: boolean;
  isReady: boolean;
  currentSentenceIndex: number;
  totalSentences: number;
  currentTime: number;
  duration: number;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  playFromSentence: (index: number) => void;
  stop: () => void;
}

export function useAudioPlayback(
  alignment: AudioAlignment | null,
): UseAudioPlaybackReturn {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [currentSentenceIndex, setCurrentSentenceIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  // Store alignment in a ref so RAF callback always has latest
  const alignmentRef = useRef(alignment);
  alignmentRef.current = alignment;

  const sentenceIndexRef = useRef(0);

  // Find which sentence is active for a given time
  const findSentenceIndex = useCallback(
    (time: number): number => {
      if (!alignment) return 0;
      const { alignments } = alignment;
      for (let i = 0; i < alignments.length; i++) {
        if (time >= alignments[i].startTime && time < alignments[i].endTime) {
          return i;
        }
      }
      // If past all alignments, return last
      if (alignments.length > 0 && time >= alignments[alignments.length - 1].endTime) {
        return alignments.length - 1;
      }
      return 0;
    },
    [alignment],
  );

  // RAF loop for tracking time
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || audio.paused) return;

    const time = audio.currentTime;
    setCurrentTime(time);

    const idx = findSentenceIndex(time);
    if (idx !== sentenceIndexRef.current) {
      sentenceIndexRef.current = idx;
      setCurrentSentenceIndex(idx);
    }

    rafRef.current = requestAnimationFrame(tick);
  }, [findSentenceIndex]);

  // Create/update audio element when alignment changes
  useEffect(() => {
    // Clean up previous
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.removeAttribute("src");
      audioRef.current.load();
      audioRef.current = null;
    }
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    setIsPlaying(false);
    setIsReady(false);
    setCurrentSentenceIndex(0);
    setCurrentTime(0);
    setDuration(0);
    sentenceIndexRef.current = 0;

    if (!alignment) return;

    const audio = new Audio(alignment.audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      setDuration(audio.duration);
      setIsReady(true);
    };

    const onEnded = () => {
      setIsPlaying(false);
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const onError = () => {
      // Audio failed to load — still allow UI to render, just can't play
      setIsReady(false);
    };

    audio.addEventListener("loadedmetadata", onLoadedMetadata);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);

    return () => {
      audio.removeEventListener("loadedmetadata", onLoadedMetadata);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("error", onError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [alignment]);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.play().then(() => {
      setIsPlaying(true);
      rafRef.current = requestAnimationFrame(tick);
    }).catch(() => {
      // Autoplay blocked or other error
    });
  }, [tick]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.pause();
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const toggle = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
  }, [isPlaying, play, pause]);

  const playFromSentence = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      const al = alignmentRef.current;
      if (!audio || !al) return;

      const clamped = Math.max(0, Math.min(index, al.alignments.length - 1));
      audio.currentTime = al.alignments[clamped].startTime;
      sentenceIndexRef.current = clamped;
      setCurrentSentenceIndex(clamped);
      setCurrentTime(al.alignments[clamped].startTime);

      if (!isPlaying) {
        play();
      }
    },
    [isPlaying, play],
  );

  const next = useCallback(() => {
    const al = alignmentRef.current;
    if (!al) return;
    const nextIdx = sentenceIndexRef.current + 1;
    if (nextIdx < al.alignments.length) {
      playFromSentence(nextIdx);
    }
  }, [playFromSentence]);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    const al = alignmentRef.current;
    if (!audio || !al) return;

    const currentIdx = sentenceIndexRef.current;
    const currentAlignment = al.alignments[currentIdx];

    // If more than 2 seconds into current sentence, restart it
    if (currentAlignment && audio.currentTime - currentAlignment.startTime > 2) {
      playFromSentence(currentIdx);
    } else if (currentIdx > 0) {
      playFromSentence(currentIdx - 1);
    } else {
      playFromSentence(0);
    }
  }, [playFromSentence]);

  const stop = useCallback(() => {
    pause();
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = 0;
    }
    sentenceIndexRef.current = 0;
    setCurrentSentenceIndex(0);
    setCurrentTime(0);
  }, [pause]);

  return {
    isPlaying,
    isReady,
    currentSentenceIndex,
    totalSentences: alignment?.alignments.length ?? 0,
    currentTime,
    duration,
    play,
    pause,
    toggle,
    next,
    prev,
    playFromSentence,
    stop,
  };
}
