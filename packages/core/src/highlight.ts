/** Draw ranges with the CSS Custom Highlight API (style via ::highlight(name)). */
export function setHighlight(name: string, ranges: Range[]): void {
  CSS.highlights.set(name, new Highlight(...ranges));
}

export function clearHighlight(name: string): void {
  CSS.highlights.delete(name);
}

/** Scroll the range's block to the middle of the viewport if it's off-screen. */
export function scrollToRange(range: Range): void {
  const rect = range.getBoundingClientRect();
  if (rect.top < 0 || rect.bottom > window.innerHeight) {
    range.startContainer.parentElement?.scrollIntoView({
      behavior: "smooth",
      block: "center",
    });
  }
}
