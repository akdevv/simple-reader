/** A single sentence extracted from article sections */
export interface Sentence {
  id: string; // "s-0", "s-1", etc.
  text: string; // Plain text (stripped of markdown formatting)
  sectionIndex: number; // Index into article's sections array
  itemIndex?: number; // For list sections: which item in items[]
}

/** Time alignment for one sentence */
export interface SentenceAlignment {
  sentenceId: string; // Matches Sentence.id
  startTime: number; // Seconds
  endTime: number; // Seconds
}

/** Full audio alignment data */
export interface AudioAlignment {
  audioUrl: string;
  sentences: Sentence[];
  alignments: SentenceAlignment[];
  totalDuration: number; // Seconds
}
