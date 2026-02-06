import { Sentence, AudioAlignment, SentenceAlignment } from "@/lib/types/audio";

/**
 * Generate mock alignment data for testing.
 * Each sentence gets a duration based on word count (~150 wpm = 2.5 words/sec).
 */
export function generateMockAlignment(
  sentences: Sentence[],
  audioUrl: string,
): AudioAlignment {
  const alignments: SentenceAlignment[] = [];
  let currentTime = 0;

  for (const sentence of sentences) {
    const wordCount = sentence.text.split(/\s+/).length;
    const duration = Math.max(1, wordCount / 2.5);

    alignments.push({
      sentenceId: sentence.id,
      startTime: Math.round(currentTime * 100) / 100,
      endTime: Math.round((currentTime + duration) * 100) / 100,
    });

    currentTime += duration;
  }

  return {
    audioUrl,
    sentences,
    alignments,
    totalDuration: Math.round(currentTime * 100) / 100,
  };
}
