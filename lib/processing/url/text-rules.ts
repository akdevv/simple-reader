/**
 * Rules for filtering boilerplate HTML elements and content during text
 * extraction. Consumed by text-extractor.ts and index.ts (cleanPopups).
 */

// --- Popup / overlay cleanup (pre-Readability) ---

const POPUP_SELECTORS_SAFE = [
  '[role="dialog"]',
  '[aria-modal="true"]',
];

const POPUP_CLASS_PATTERNS = [
  /\bcookie[-_]?banner\b/i,
  /\bcookie[-_]?consent\b/i,
  /\bconsent[-_]?modal\b/i,
  /\bconsent[-_]?banner\b/i,
  /\bcookie[-_]?notice\b/i,
  /\bgdpr\b/i,
  /\bpopup[-_]?overlay\b/i,
  /\bmodal[-_]?overlay\b/i,
  /\bpaywall[-_]?modal\b/i,
  /\bsubscribe[-_]?wall\b/i,
  /\blogin[-_]?wall\b/i,
  /\bgate[-_]?modal\b/i,
];

export function cleanPopups(document: Document): number {
  let removedCount = 0;

  // Remove elements matching safe ARIA selectors
  for (const selector of POPUP_SELECTORS_SAFE) {
    try {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        el.remove();
        removedCount++;
      });
    } catch {
      // Invalid selector, skip
    }
  }

  // Remove elements whose class or id matches popup patterns
  const allElements = document.querySelectorAll("*");
  allElements.forEach((el) => {
    const cls = el.getAttribute("class") || "";
    const id = el.getAttribute("id") || "";
    const combined = `${cls} ${id}`;

    for (const pattern of POPUP_CLASS_PATTERNS) {
      if (pattern.test(combined)) {
        el.remove();
        removedCount++;
        return; // element already removed, skip other patterns
      }
    }
  });

  // Remove position:fixed elements with high z-index
  document.querySelectorAll("*").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") || "";
    if (
      /position\s*:\s*fixed/i.test(style) &&
      /z-index\s*:\s*(\d+)/i.test(style)
    ) {
      const zMatch = style.match(/z-index\s*:\s*(\d+)/i);
      if (zMatch && parseInt(zMatch[1], 10) > 999) {
        el.remove();
        removedCount++;
      }
    }
  });

  // Remove scroll locks from body/html
  const body = document.querySelector("body");
  const html = document.querySelector("html");
  for (const el of [body, html]) {
    if (el) {
      const style = el.getAttribute("style") || "";
      if (/overflow\s*:\s*hidden/i.test(style)) {
        el.setAttribute(
          "style",
          style.replace(/overflow\s*:\s*hidden\s*;?/gi, "")
        );
      }
    }
  }

  // Strip blur / max-height clipping inline styles
  document.querySelectorAll("*").forEach((el) => {
    const style = (el as HTMLElement).getAttribute("style") || "";
    if (/filter\s*:.*blur|max-height\s*:/i.test(style)) {
      const cleaned = style
        .replace(/filter\s*:[^;]*blur[^;]*;?/gi, "")
        .replace(/max-height\s*:[^;]*;?/gi, "")
        .trim();
      if (cleaned) {
        (el as HTMLElement).setAttribute("style", cleaned);
      } else {
        (el as HTMLElement).removeAttribute("style");
      }
    }
  });

  return removedCount;
}

// --- Content-preserving container rules ---

/**
 * Tags that signal a container holds real content and must never be dropped.
 * If any of these exist anywhere inside a container, keep the container.
 */
const CONTENT_TAGS = new Set([
  "PRE", "CODE", "KBD", "BLOCKQUOTE",
]);

/**
 * Returns true if the element contains content that must be preserved
 * (code blocks, kbd, blockquotes, or substantial text).
 */
export function hasProtectedContent(el: Element): boolean {
  // Check for content-bearing tags anywhere inside
  for (const tag of CONTENT_TAGS) {
    if (el.tagName.toUpperCase() === tag) return true;
    if (el.querySelector(tag.toLowerCase())) return true;
  }

  // Keep containers with substantial text (> 80 chars after stripping whitespace)
  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  if (text.length > 80) return true;

  return false;
}

// --- UI chrome removal (inside kept containers) ---

/**
 * Tags that are considered UI chrome / non-content and should be stripped
 * from inside content containers before extraction.
 */
const UI_CHROME_TAGS = new Set([
  "BUTTON", "SVG", "CANVAS",
  "INPUT", "SELECT", "TEXTAREA", "FORM",
  "LABEL",
]);

/**
 * Remove UI chrome elements (buttons, svgs, icons, form elements) from
 * inside a container. Mutates the DOM. Call before extracting text.
 */
export function stripUiChrome(el: Element): void {
  // Remove explicit UI chrome tags
  for (const tag of UI_CHROME_TAGS) {
    el.querySelectorAll(tag.toLowerCase()).forEach((child) => child.remove());
  }

  // Remove elements that are purely iconic (img/span with no meaningful text,
  // with aria-hidden or role="img" or presentation role)
  el.querySelectorAll('[aria-hidden="true"], [role="presentation"], [role="img"]').forEach((child) => {
    child.remove();
  });
}

// --- Boilerplate element rules (post-Readability) ---

/**
 * HTML tags whose content should be skipped during section extraction,
 * UNLESS they contain protected content.
 */
export const BOILERPLATE_TAGS = new Set([
  "HEADER",
  "FOOTER",
  "NAV",
  "ASIDE",
]);

export function isBoilerplateElement(el: Element): boolean {
  if (!BOILERPLATE_TAGS.has(el.tagName.toUpperCase())) return false;
  // Never filter if it contains protected content
  if (hasProtectedContent(el)) return false;
  return true;
}

// --- "Related articles" / recommendation section rules ---

const RELATED_CONTENT_PATTERNS = [
  /\brelated\s+(?:articles?|posts?|stories|content)\b/i,
  /\brecommended\s+(?:for you|articles?|posts?|stories)\b/i,
  /\byou\s+may\s+also\s+like\b/i,
  /\bmore\s+stories\b/i,
  /\bmore\s+from\b/i,
  /\btrending\b/i,
  /\bpopular\s+(?:articles?|posts?|stories)\b/i,
  /\bfurther\s+reading\b/i,
  /\bdon'?t\s+miss\b/i,
  /\bwhat\s+to\s+read\s+next\b/i,
];

/**
 * Check if an element is a "related articles" / recommendation section
 * by inspecting direct child headings only (never class names).
 * Protected content always takes priority.
 */
export function isRelatedContentSection(el: Element): boolean {
  // Never filter if it contains protected content
  if (hasProtectedContent(el)) return false;

  // Check direct child headings (h2–h4) for related content text
  for (const heading of Array.from(el.querySelectorAll(":scope > h2, :scope > h3, :scope > h4"))) {
    const text = (heading.textContent || "").trim();
    for (const pattern of RELATED_CONTENT_PATTERNS) {
      if (pattern.test(text)) return true;
    }
  }

  return false;
}
