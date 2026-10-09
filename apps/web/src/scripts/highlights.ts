// Reader highlights + notes: select text → Highlight / Add note; click a highlight to edit.
import { actions } from "astro:actions";
import {
  anchorFromRange,
  mapText,
  rangeFromAnchor,
  type Anchor,
} from "@sr/core";

export interface StoredHighlight extends Anchor {
  id: string;
  note: string | null;
}

interface Drawn extends StoredHighlight {
  range: Range;
}

// must match ::highlight(...) in global.css
const MARK = "sr-note";
const MARK_WITH_NOTE = "sr-note-text";

const button =
  "rounded-xs px-2.5 py-1.5 text-sm hover:bg-muted disabled:opacity-50";

export function mountHighlights(
  root: HTMLElement,
  articleId: string,
  initial: StoredHighlight[],
): { markdown(): string } {
  const map = mapText(root);
  const items: Drawn[] = [];
  for (const h of initial) {
    const range = rangeFromAnchor(map, h);
    if (range) items.push({ ...h, range });
  }

  function draw(): void {
    items.sort((a, b) => a.start - b.start);
    CSS.highlights.set(MARK, new Highlight(...items.map((h) => h.range)));
    CSS.highlights.set(
      MARK_WITH_NOTE,
      new Highlight(...items.filter((h) => h.note).map((h) => h.range)),
    );
  }
  draw();

  /* ----- popover ----- */

  const pop = document.createElement("div");
  pop.className =
    "fixed z-50 hidden max-w-[calc(100vw-2rem)] rounded-xs border border-border bg-card p-1 shadow-lg";
  pop.setAttribute("role", "dialog");
  document.body.append(pop);

  function show(range: Range, content: HTMLElement[]): void {
    pop.replaceChildren(...content);
    pop.classList.remove("hidden");
    const r = range.getBoundingClientRect();
    const { width, height } = pop.getBoundingClientRect();
    const above = r.top - height - 8;
    pop.style.top = `${above > 8 ? above : r.bottom + 8}px`;
    pop.style.left = `${Math.min(Math.max(8, r.left + r.width / 2 - width / 2), innerWidth - width - 8)}px`;
  }

  function hide(): void {
    pop.classList.add("hidden");
  }

  function el<K extends keyof HTMLElementTagNameMap>(
    tag: K,
    props: Partial<HTMLElementTagNameMap[K]>,
  ): HTMLElementTagNameMap[K] {
    return Object.assign(document.createElement(tag), props);
  }

  /** Note editor for a new (anchor) or existing (drawn) highlight. */
  function editor(range: Range, target: Anchor | Drawn): void {
    const existing = "id" in target ? target : null;
    const text = el("textarea", {
      value: existing?.note ?? "",
      placeholder: "Write a note…",
      rows: 3,
      maxLength: 5000,
      className:
        "block w-72 max-w-full resize-y rounded-xs bg-background p-2 text-sm outline-none",
    });
    const save = el("button", {
      textContent: "Save",
      className: `${button} text-secondary`,
    });
    const remove = el("button", {
      textContent: "Delete highlight",
      className: `${button} text-red-400`,
    });
    const row = el("div", { className: "mt-1 flex justify-between gap-2" });
    row.append(save, ...(existing ? [remove] : []));

    save.onclick = async () => {
      save.disabled = true;
      const note = text.value.trim();
      if (existing) {
        const { error } = await actions.updateNote({ id: existing.id, note });
        if (!error) existing.note = note || null;
      } else await create(target, range, note);
      draw();
      hide();
    };
    remove.onclick = async () => {
      remove.disabled = true;
      const { error } = await actions.deleteHighlight({ id: existing!.id });
      if (!error) items.splice(items.indexOf(existing!), 1);
      draw();
      hide();
    };
    show(range, [text, row]);
    text.focus();
  }

  async function create(
    anchor: Anchor,
    range: Range,
    note?: string,
  ): Promise<void> {
    const { data, error } = await actions.addHighlight({
      articleId,
      ...anchor,
      note,
    });
    if (error) return alertError(error.message);
    items.push({ ...anchor, id: data.id, note: note || null, range });
    document.getSelection()?.removeAllRanges();
  }

  function alertError(message: string): void {
    pop.replaceChildren(
      el("p", {
        textContent: `Couldn't save: ${message}`,
        className: "p-2 text-sm text-red-400",
      }),
    );
  }

  /* ----- events ----- */

  // selectionchange covers mouse, keyboard and touch selection
  let timer = 0;
  document.addEventListener("selectionchange", () => {
    clearTimeout(timer);
    timer = window.setTimeout(() => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return;
      const range = sel.getRangeAt(0);
      if (!root.contains(range.commonAncestorContainer)) return;
      const anchor = anchorFromRange(map, range);
      if (!anchor) return;
      const mark = el("button", {
        textContent: "Highlight",
        className: button,
      });
      const note = el("button", { textContent: "Add note", className: button });
      mark.onclick = async () => {
        mark.disabled = true;
        await create(anchor, range.cloneRange());
        draw();
        hide();
      };
      note.onclick = () => editor(range.cloneRange(), anchor);
      show(range, [mark, note]);
    }, 250);
  });

  // capture phase: runs before the reader's click-to-seek, and stops it
  root.addEventListener(
    "click",
    (e) => {
      if (!document.getSelection()?.isCollapsed) return;
      const pos = document.caretPositionFromPoint?.(e.clientX, e.clientY);
      const caret: [Node, number] | null = pos
        ? [pos.offsetNode, pos.offset]
        : (() => {
            const r = document.caretRangeFromPoint?.(e.clientX, e.clientY);
            return r ? [r.startContainer, r.startOffset] : null;
          })();
      if (!caret) return;
      const hit = items.find((h) => h.range.isPointInRange(caret[0], caret[1]));
      if (!hit || (e.target as Element).closest("a")) return;
      e.preventDefault();
      editor(hit.range, hit);
    },
    true,
  );

  document.addEventListener("mousedown", (e) => {
    if (!pop.contains(e.target as Node)) hide();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") hide();
  });
  addEventListener("scroll", hide, { passive: true });

  // /app/a/<id>#h-<highlight id>: jump to that highlight
  const target = items.find((h) => location.hash === `#h-${h.id}`);
  target?.range.startContainer.parentElement?.scrollIntoView({
    block: "center",
  });

  return {
    markdown() {
      return items
        .map((h) => `> ${h.quote}${h.note ? `\n\n${h.note}` : ""}`)
        .join("\n\n---\n\n");
    },
  };
}
