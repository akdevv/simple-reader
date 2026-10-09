import type { ReaderState } from "./types";
import type { Player } from "./tts/player";
import { segment } from "./segment";
import { clearHighlight, scrollToRange, setHighlight } from "./highlight";

/** must match ::highlight(sr-sentence) in the host's CSS */
export const SENTENCE_HIGHLIGHT = "sr-sentence";

export interface ReaderOptions {
  /** sentence to resume from */
  startAt?: number;
  /** every player state change, for the host's controls and position saving */
  onState?: (state: ReaderState) => void;
}

export interface ReaderHandle {
  destroy(): void;
}

const KEYS: Record<string, (p: Player) => void> = {
  Space: (p) => p.toggle(),
  ArrowRight: (p) => p.next(),
  ArrowLeft: (p) => p.prev(),
};

function isEditable(target: EventTarget | null): boolean {
  return (
    target instanceof Element &&
    !!target.closest("input, textarea, select, [contenteditable]")
  );
}

/** Text position under a viewport point (standard API first, Chrome's fallback). */
function caretAt(x: number, y: number, root: Node): [Node, number] | null {
  const shadowRoots =
    root.getRootNode() instanceof ShadowRoot
      ? [root.getRootNode() as ShadowRoot]
      : [];
  if (document.caretPositionFromPoint) {
    const pos = document.caretPositionFromPoint(x, y, { shadowRoots });
    return pos ? [pos.offsetNode, pos.offset] : null;
  }
  const range = document.caretRangeFromPoint?.(x, y);
  return range ? [range.startContainer, range.startOffset] : null;
}

/**
 * Wire audio, sentence highlighting, keys and click-to-seek onto an article
 * that is already rendered in root. Used by the web reader page and the
 * extension overlay.
 */
export function mountReader(
  root: HTMLElement,
  player: Player,
  { startAt = 0, onState }: ReaderOptions = {},
): ReaderHandle {
  const sentences = segment(root);
  let lastIndex = -1;

  const unsubscribe = player.subscribe((state) => {
    const s = sentences[state.index];
    if (s && state.phase !== "idle") {
      setHighlight(SENTENCE_HIGHLIGHT, [s.range]);
      if (state.index !== lastIndex) scrollToRange(s.range);
    } else clearHighlight(SENTENCE_HIGHLIGHT);
    lastIndex = state.index;
    onState?.(state);
  });
  player.load(
    sentences.map((s) => s.text),
    startAt,
  );

  function onKeydown(e: KeyboardEvent): void {
    const action = KEYS[e.code];
    if (!action || isEditable(e.target)) return;
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    e.preventDefault();
    action(player);
  }

  // Click a sentence → read from there. Never hijack links/controls or a text selection.
  function onClick(e: MouseEvent): void {
    if (e.defaultPrevented || e.button !== 0) return;
    if (
      e.target instanceof Element &&
      e.target.closest("a, button, input, textarea, select, [contenteditable]")
    )
      return;
    if (!document.getSelection()?.isCollapsed) return;
    const caret = caretAt(e.clientX, e.clientY, root);
    if (!caret) return;
    const index = sentences.findIndex((s) =>
      s.range.isPointInRange(caret[0], caret[1]),
    );
    if (index >= 0) player.seek(index);
  }

  document.addEventListener("keydown", onKeydown);
  root.addEventListener("click", onClick);

  return {
    destroy() {
      document.removeEventListener("keydown", onKeydown);
      root.removeEventListener("click", onClick);
      unsubscribe();
      player.stop();
      clearHighlight(SENTENCE_HIGHLIGHT);
    },
  };
}
