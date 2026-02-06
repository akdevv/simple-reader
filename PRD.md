# Simple Reader — Product Requirements Document (PRD)

**Version:** 1.0  
**Last updated:** February 2026  
**Status:** Draft

---

## 1. Overview

### 1.1 Vision

Simple Reader is a **minimal, distraction-free article reader** with synced text-to-speech. Users can add articles either by **pasting a URL** (content is extracted from the web) or by **pasting or typing text** (plain text or Markdown). The app presents content in a clean, readable layout, supports listen-along with sentence-level highlighting, and persists reading progress—all with a **clean, minimalistic, dark-mode-first UI** that follows the system theme.

### 1.2 Core Value Propositions

- **Dual input:** Add content via link (extract) or pasted/typed text (plain or Markdown).
- **Distraction-free reading:** Stripped layout, comfortable typography, no ads or clutter.
- **Synced TTS:** Listen while reading with real-time sentence highlighting.
- **Save & resume:** Reading position and progress are persisted per session.
- **Minimal, themed UI:** Dark mode by default, respects system preference; shadcn + Tailwind only.

### 1.3 Target Users

- Readers who want to focus on long-form content without site clutter.
- Users who prefer listening (commute, accessibility, multitasking).
- People who save articles from various sources (links and copied text) in one place.

---

## 2. Tech Stack & Conventions

| Layer | Choice | Notes |
|-------|--------|--------|
| Framework | Next.js (App Router) | TypeScript throughout |
| Styling | Tailwind CSS v4 | Only Tailwind; no custom CSS frameworks |
| UI components | shadcn/ui (themed) | New York style; use existing themed tokens |
| Database | PostgreSQL | Local development via Docker |
| ORM | Prisma | Schema in `prisma/schema.prisma`; client in `lib/generated/prisma` |
| Article extraction (URL) | Mozilla Readability + JSDOM | Server-side fetch and parse |
| TTS | Web Speech API | Browser-native; no backend audio |
| Auth (v1) | Cookie-based session token | Lightweight; no login required |
| Deployment | TBD (e.g. Vercel) | Postgres can be Vercel Postgres or external |

**Local development:** Postgres runs via Docker Compose (`docker-compose.yml`). Connection string is provided via environment (e.g. `POSTGRES_URL` or `DATABASE_URL`). No Drizzle; Prisma only.

---

## 3. User Input Modes

The product must support **two ways** of adding article content.

### 3.1 Mode A: URL (Link)

- **User action:** Pastes or types a valid `http`/`https` URL.
- **System behavior:**
  1. Validate URL format and protocol.
  2. Create an article record (e.g. status `PENDING`, `url` set).
  3. Trigger server-side processing: fetch page, run Mozilla Readability + JSDOM, extract title, excerpt, site name, and main content.
  4. Convert extracted content into the app’s canonical section format (e.g. paragraphs, headings).
  5. Segment text into sentences for TTS and highlighting.
  6. Store sections (and optionally TTS-related data) and set status to `READY` (or `ERROR` on failure).
- **Edge cases:** Paywalls, SPAs, PDFs, or non-article pages may fail extraction; show a clear, user-friendly error. Duplicate URLs may redirect to the existing article or show a message.

### 3.2 Mode B: Pasted / Typed Text

- **User action:** Pastes or types content into a dedicated input (textarea or similar). Content can be:
  - **Plain text:** free-form text with line breaks.
  - **Markdown:** headings, lists, bold/italic, code, etc.
- **System behavior:**
  1. Accept raw string from the client.
  2. **Normalize and clean:**
     - Trim leading/trailing whitespace.
     - Normalize line endings (e.g. to `\n`).
     - If Markdown: parse (e.g. with a Markdown parser) and convert to the same canonical section structure used for URL-extracted articles (paragraphs, headings, lists if needed).
     - If plain text: split into paragraphs (e.g. by double newlines or single newlines) and map to sections.
  3. No URL is required; store with a null or placeholder `url` (or a dedicated “source” type so the UI can show “Pasted article” instead of “View original”).
  4. Run the same sentence-segmentation and storage pipeline as URL flow so that TTS and highlighting work identically.
- **Data model:** Articles created from pasted text must be representable in the same `Article` (and related) tables—e.g. `sourceType: 'url' | 'pasted'`, and `url` optional when `sourceType === 'pasted'`.

**Product requirement:** Both modes must result in the same reader experience: same layout, same TTS, same progress persistence. No second-class experience for pasted text.

---

## 4. Data Model (Prisma)

### 4.1 Current Conventions

- **Database:** PostgreSQL; local via Docker; Prisma as the only ORM.
- **Article:** Identified by `id`; has `userId`, `url`, `status`, `title`, `excerpt`, `siteName`, `sections` (JSON), `media` (JSON), `ttsAudio` (JSON), timestamps.
- **Status enum:** `PENDING`, `PROCESSING`, `READY`, `ERROR`, `TTS_PROCESSING`, `TTS_READY` (or as needed for future TTS pipeline).

### 4.2 Extensions for Pasted Text

- **Source type:** Add a way to distinguish URL-sourced vs pasted articles, e.g.:
  - Optional enum or string: `sourceType` (`'url' | 'pasted'`), or
  - Treat `url` as optional; if `url` is null/empty, treat as pasted.
- **Pasted articles:** For pasted content, `url` may be null or a sentinel (e.g. `''` or a special value). `title` can be derived from first heading or first line, or “Untitled” / “Pasted article”. `siteName` can be null. `excerpt` can be first paragraph or null.

### 4.3 Future (Out of Scope for Initial PRD)

- **Sentences table:** If the app moves to DB-stored sentences for TTS, add a `Sentence` (or similar) model with `articleId`, `index`, `text`, `paragraphIndex`.
- **Reading progress:** If progress is persisted in DB, add a `ReadingProgress` (or similar) model with `articleId`, `userId`, `lastSentenceIndex`, `scrollPosition`, `updatedAt`.

The PRD assumes the current schema can be extended with the above concepts when those features are implemented.

---

## 5. API Contract (High Level)

### 5.1 Create Article

- **POST /api/article**
  - **URL flow:** Body `{ url: string }`. Validate URL → create row (e.g. `PENDING`) → return `{ data: { id } }`. Client then triggers processing (e.g. POST to `/api/article/[id]/process`).
  - **Pasted flow:** Body `{ content: string, title?: string, format?: 'plain' | 'markdown' }`. Normalize/parse content → build sections → create article in `READY` (or equivalent) with `sourceType: 'pasted'` and no URL → return `{ data: { id, ... } }`. No separate “process” step required if content is ready immediately.

Alternatively, a single endpoint can accept either `url` or `content` and branch internally.

### 5.2 Get Article

- **GET /api/article/[id]**  
  Returns full article (including sections, media, status). Used by reader and library.

### 5.3 Process Article (URL Only)

- **POST /api/article/[id]/process**  
  Idempotent: fetch URL, extract content, segment sentences, update article to `READY` (or `ERROR`). Only applicable when article was created from a URL.

### 5.4 List Articles

- **GET /api/articles** (or equivalent)  
  List articles for the current user/session; support pagination and optional filters (e.g. status, source type).

### 5.5 Update / Delete

- **PATCH /api/article/[id]** — e.g. status updates.
- **DELETE /api/article/[id]** — soft or hard delete per product decision.

### 5.6 Reading Progress (Future)

- **PATCH /api/article/[id]/progress** — save `lastSentenceIndex`, `scrollPosition`.
- **GET** (or part of article response) — restore position on load.

---

## 6. UI/UX Requirements

### 6.1 Design Principles

- **Clean and minimalistic:** No visual clutter. Plenty of whitespace, clear hierarchy, single-column reading.
- **Dark mode first:** Default is dark. All core flows must look correct in dark theme.
- **System theme:** Follow the user’s system preference (light/dark). Use CSS/Tailwind so that when the system is dark, the app is dark; when light, the app is light. No manual theme toggle required in v1 unless product explicitly adds it.
- **Themed shadcn only:** Use only shadcn/ui components and Tailwind. No one-off component libraries. Rely on the existing themed tokens (e.g. `background`, `foreground`, `muted`, `primary`, `border`, `card`) so light/dark and system theme are consistent.

### 6.2 Theming Implementation

- **Strategy:** Prefer class-based or media-query-based dark mode (e.g. `class="dark"` on `html` when system is dark, or `prefers-color-scheme: dark` in CSS). Ensure `globals.css` (or equivalent) defines both `:root` and `.dark` (or media) variables used by shadcn.
- **Tokens:** All UI must use semantic tokens (e.g. `bg-background`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-card`) so that switching theme does not require component changes.
- **No hardcoded light-only colors:** Avoid fixed light grays or whites for main surfaces; use theme variables so dark mode is first-class.

### 6.3 Key Screens / Flows

- **Home / Add content:**  
  - Prominent input for **URL** and a clear way to **paste text** (e.g. tab or toggle: “Add by link” vs “Paste text”).  
  - For paste: textarea, optional format selector (plain / Markdown), optional title.  
  - Buttons: “Add article” (or “Read it”) for URL; “Save and read” (or similar) for pasted text.  
  - Clean, minimal layout; no unnecessary decoration.

- **Library / List:**  
  - List of articles (cards or rows): title, excerpt, source (URL hostname or “Pasted”), status, date.  
  - Filter/tabs by status if needed. Search by title/excerpt.  
  - Actions: open, delete, maybe change status.  
  - Empty states: clear message and CTA to add first article (link or paste).

- **Reader:**  
  - Single article view: title, metadata (date, “View original” only when URL exists), then body.  
  - Body: sections rendered from stored structure (headings, paragraphs; lists if supported).  
  - Typography: readable font size (~18–20px body), comfortable line height (e.g. 1.6–1.8), max width (~680px).  
  - Progress bar at top (optional in v1).  
  - TTS: play/pause, sentence highlighting, optional click-to-jump and keyboard shortcuts (as per DEV_PLAN Phase 3).  
  - Back to library/home: clear, minimal control.

### 6.4 Responsiveness & Accessibility

- Layouts must work on mobile (e.g. 375px), tablet, and desktop.
- Use semantic HTML and ARIA where needed; focus states and keyboard navigation for interactive elements.
- TTS and reader must remain usable when system theme is light or dark.

---

## 7. Content Pipeline (Detail)

### 7.1 URL Path

1. **Fetch:** Server-side HTTP GET to user-provided URL (respect robots.txt and timeouts in future; v1 can be best-effort).
2. **Parse:** JSDOM + Readability → title, excerpt, byline/site, main content HTML.
3. **Normalize:** Convert HTML to canonical section list (e.g. `{ type: 'paragraph' | 'heading', content: string }[]`); strip scripts and unsafe tags; optional sanitization (e.g. DOMPurify) if rendering HTML elsewhere.
4. **Segment:** Run sentence-splitter (e.g. `Intl.Segmenter` or regex) on plain text derived from sections; store for TTS and highlighting.
5. **Store:** Update article with `title`, `excerpt`, `siteName`, `sections`, `media` (if any), status `READY`. On failure, set status `ERROR` and optionally store an error message/code.

### 7.2 Pasted-Text Path

1. **Accept:** Raw string from client; optional `format`: `'plain' | 'markdown'`.
2. **Clean:** Trim, normalize line endings, optionally collapse excessive blank lines.
3. **Parse:**
   - **Markdown:** Use a single Markdown parser (e.g. `marked`, `remark`, or similar) to produce a structure that maps to the same section format (e.g. headings → `type: 'heading'`, paragraphs → `type: 'paragraph'`). Lists and blockquotes can map to paragraph or dedicated types if the schema supports them.
   - **Plain:** Split by `\n\n` (or `\n`) into paragraphs; each paragraph is one section. First line can be treated as title if no title provided.
4. **Title:** Use provided `title`, or first heading (Markdown), or first line (plain), or “Untitled” / “Pasted article”.
5. **Segment:** Same sentence-splitter as URL path; produce sentence list for TTS.
6. **Store:** Create article with `sourceType: 'pasted'`, `url` null/empty, `sections`, `title`, status `READY` immediately (no async processing step).

---

## 8. Error Handling & Edge Cases

- **Invalid URL:** 400 with message like “Please enter a valid URL.”
- **Unsupported protocol:** 400 with “Only http and https URLs are supported.”
- **Extraction failure:** 422 or 500 with user-friendly message, e.g. “We couldn’t fetch or parse this article. Try a different link or paste the text instead.”
- **Duplicate URL:** Either return existing article id (and redirect client) or 409 with message.
- **Empty or too-short pasted text:** Validate minimum length; 400 with “Please paste or enter some content.”
- **TTS unsupported:** Detect Web Speech API support; show a short message in reader instead of breaking.
- **Network errors:** Retry or clear error messages on the client; do not leave spinner forever.

---

## 9. Non-Functional Requirements

- **Performance:** First contentful paint and time-to-interactive should feel fast; list and reader should not block on unnecessary work.
- **Security:** Sanitize any HTML rendered from extracted or pasted content to prevent XSS. Validate and sanitize URLs (no `javascript:`, etc.).
- **Rate limiting:** Consider rate limiting article creation (e.g. per session) to avoid abuse of extraction and storage.
- **Secrets:** Database URL and any API keys in environment variables only; never committed.

---

## 10. Out of Scope (Explicit)

- User accounts / sign-up / login (v1 is session-based only).
- Sharing articles or public links.
- Browser extension or mobile app (web only for v1).
- Offline support or PWA install.
- Custom TTS voices or cloud TTS in initial version (Web Speech API only).
- Full-text search across article body in v1 (title/excerpt search is in scope if library exists).

---

## 11. Success Criteria (Summary)

- User can add an article by **URL** and get extracted, readable content in the reader.
- User can add an article by **pasting plain text or Markdown** and get the same reader experience.
- Reader is clean, minimal, dark-mode-first, and follows system theme using only shadcn and Tailwind.
- TTS (when implemented) works with both URL and pasted articles with sentence-level sync.
- Reading progress (when implemented) is persisted and restorable.
- All article data is stored in PostgreSQL via Prisma; local dev uses Docker Postgres.
- No TypeScript or lint errors; builds and runs per project standards.

---

## 12. References

- **DEV_PLAN.md** — Phased development plan (scaffolding, extraction, reader UI, TTS, auth, polish).
- **prisma/schema.prisma** — Current data model; extend for `sourceType` and pasted content.
- **docker-compose.yml** — Local Postgres setup.
- **app/globals.css** — Themed tokens for light/dark and shadcn.
- **components.json** — shadcn (New York, Tailwind, CSS variables).

---

*This PRD should be updated when input modes, data model, or UI/UX decisions change.*
