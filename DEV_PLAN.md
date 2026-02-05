# Simple Reader — Development Plan

> A minimal, distraction-free article reader with synced text-to-speech.

---

## Tech Stack Summary

| Layer          | Choice                                    |
| -------------- | ----------------------------------------- |
| Framework      | Next.js 16 (App Router)                   |
| Language       | TypeScript                                |
| Styling        | Tailwind CSS v4                           |
| Database       | Vercel Postgres (via `@vercel/postgres`)  |
| ORM            | Drizzle ORM                               |
| Auth (v1)      | Cookie-based session token (lightweight)  |
| TTS            | Web Speech API (browser-native)           |
| Article Parser | Mozilla Readability + JSDOM               |
| Deployment     | Vercel                                    |

---

## Phase 1 — Project Scaffolding & Article Extraction

**Goal:** Set up the project foundation and build the core article-fetching pipeline.

### 1.1 Project Initialization

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Initialize Next.js project | `npx create-next-app@latest` with App Router, TypeScript, Tailwind CSS, ESLint | Working Next.js app at `localhost:3000` |
| 2 | Configure project structure | Create folder conventions: `app/`, `lib/`, `components/`, `db/`, `types/` | Clean, navigable project layout |
| 3 | Install core dependencies | `@mozilla/readability`, `jsdom`, `@vercel/postgres`, `drizzle-orm`, `drizzle-kit` | All deps in `package.json` |
| 4 | Set up environment variables | Create `.env.local` with `POSTGRES_URL` placeholder, add `.env*.local` to `.gitignore` | Secrets are never committed |
| 5 | Configure Drizzle ORM | Create `drizzle.config.ts`, set up database connection in `lib/db.ts` | ORM connected to Postgres |
| 6 | Set up linting & formatting | Configure ESLint + Prettier with consistent rules | `npm run lint` passes cleanly |

### 1.2 Database Schema Design

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Design `articles` table | Columns: `id`, `url`, `title`, `author`, `site_name`, `excerpt`, `content` (HTML), `plain_text`, `image_url`, `word_count`, `status` (enum: `reading`, `saved`, `completed`), `created_at`, `updated_at` | Schema file in `db/schema.ts` |
| 2 | Design `sentences` table | Columns: `id`, `article_id` (FK), `index` (order), `text`, `paragraph_index` | Schema file in `db/schema.ts` |
| 3 | Design `reading_progress` table | Columns: `id`, `article_id` (FK), `last_sentence_index`, `scroll_position`, `updated_at` | Schema file in `db/schema.ts` |
| 4 | Generate & run initial migration | Use `drizzle-kit generate` and `drizzle-kit migrate` | Tables exist in Postgres |

### 1.3 Article Fetching & Extraction API

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Create article extraction utility | `lib/article-extractor.ts` — fetch URL, parse with JSDOM + Readability, return structured data (title, content, text, author, excerpt, image) | Utility function that takes a URL and returns parsed article data |
| 2 | Create sentence segmentation utility | `lib/sentence-splitter.ts` — split plain text into sentences using `Intl.Segmenter` or regex-based approach; return array of `{ index, text, paragraphIndex }` | Utility function that takes text and returns structured sentences |
| 3 | Build `POST /api/articles` route | Accepts `{ url }`, calls extractor, splits sentences, saves article + sentences to DB, returns article object | API endpoint that saves a fully parsed article |
| 4 | Build `GET /api/articles` route | Returns list of articles (with pagination, status filter, search query) | API endpoint returning article list |
| 5 | Build `GET /api/articles/[id]` route | Returns single article with its sentences | API endpoint returning full article data |
| 6 | Build `PATCH /api/articles/[id]` route | Updates article status (`reading`, `saved`, `completed`) | API endpoint for status changes |
| 7 | Build `DELETE /api/articles/[id]` route | Soft-delete or hard-delete an article | API endpoint for article removal |
| 8 | Add input validation | Validate URL format, prevent duplicate URLs, handle fetch errors gracefully | Proper error responses (400, 404, 409, 500) |
| 9 | Add rate limiting | Basic in-memory or header-based rate limiting on the POST endpoint | Prevent abuse of the extraction endpoint |

**Phase 1 Deliverable:** You can submit a URL via API, and it extracts, parses, segments, and stores the article in the database.

---

## Phase 2 — Reader UI & Article Management

**Goal:** Build the frontend for browsing, saving, and reading articles.

### 2.1 Layout & Navigation Shell

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Create root layout | `app/layout.tsx` — global font (Inter or similar), Tailwind base styles, minimal chrome | Consistent base layout across all pages |
| 2 | Build navigation component | Sidebar or top nav with links: Home, Library, Saved, Completed | User can navigate between views |
| 3 | Create URL input component | Prominent input field + "Add Article" button on the home page; calls `POST /api/articles` | User can paste a URL and save an article |
| 4 | Add loading & error states | Skeleton loaders for article lists, toast notifications for errors | Smooth UX during async operations |

### 2.2 Article Library Pages

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Build article card component | Displays: title, excerpt, site name, image thumbnail, status badge, word count, time ago | Reusable card for all list views |
| 2 | Build library page (`/library`) | Fetches and displays all articles; tabs or filter for status (`all`, `reading`, `saved`, `completed`) | User sees all saved articles organized by status |
| 3 | Add search functionality | Text input that filters articles by title/excerpt (client-side or API query) | User can find articles quickly |
| 4 | Add article actions | Status change (mark as reading/saved/completed), delete — via dropdown menu or buttons on each card | User can manage article states from the list |
| 5 | Empty states | Friendly messages when no articles exist in a given category | No blank screens; clear calls to action |

### 2.3 Reader View Page

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Build reader page (`/article/[id]`) | Fetches article + sentences via API; renders clean, single-column layout | Distraction-free reading experience |
| 2 | Typography & spacing | Readable font size (~18-20px body), comfortable line height (1.6-1.8), max-width (~680px), proper heading hierarchy | Content is easy on the eyes for long sessions |
| 3 | Render article HTML safely | Use `dangerouslySetInnerHTML` with sanitization (DOMPurify or similar) to render extracted HTML preserving formatting | Article renders with paragraphs, headings, lists, bold/italic, links, and images |
| 4 | Sentence wrapping | Wrap each sentence in a `<span>` with a unique ID and data attribute for TTS targeting | Each sentence is individually addressable in the DOM |
| 5 | Inline images | Render images from the original article within the content flow | Images display correctly within the text |
| 6 | Reading progress bar | Thin progress bar at the top of the page based on scroll position | User sees how far through the article they are |
| 7 | Back navigation | Clear button/link to return to the library | User can easily navigate back |

**Phase 2 Deliverable:** User can paste a URL, see it appear in a library, open it in a clean reader view with properly formatted content and individually addressable sentences.

---

## Phase 3 — Synced Text-to-Speech

**Goal:** Add play/pause TTS that highlights the currently spoken sentence in real time.

### 3.1 TTS Engine (Web Speech API)

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Create TTS hook (`useTTS`) | Custom React hook that wraps `SpeechSynthesisUtterance`; manages play, pause, resume, stop, current sentence index, and speaking state | Reusable TTS logic decoupled from UI |
| 2 | Sentence queue management | Feed sentences one at a time to the Speech API; advance index on `onend` event; handle `onboundary` if needed | Sentences are spoken sequentially |
| 3 | Handle browser quirks | Some browsers pause speech after ~15 seconds; implement workaround (re-trigger or chunk) | TTS works reliably across Chrome, Safari, Firefox |
| 4 | Voice selection | Detect available voices; pick a sensible default (prefer English neural voice if available) | Good default voice; no manual config needed in v1 |

### 3.2 TTS UI Controls

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Build playback bar component | Fixed bottom bar with: play/pause button, current sentence indicator, progress (e.g., "Sentence 12 of 87") | User has clear TTS controls always visible |
| 2 | Sentence highlighting | When a sentence is being spoken, apply a highlight style (background color or underline) to the corresponding `<span>` in the reader view | User can follow along visually |
| 3 | Auto-scroll to current sentence | Smoothly scroll the viewport to keep the highlighted sentence visible | User doesn't lose their place |
| 4 | Click-to-jump | Clicking a sentence in the reader starts TTS from that sentence | User can jump to any part of the article |
| 5 | Keyboard shortcuts | Space = play/pause, Left/Right arrow = previous/next sentence | Power users can control TTS without mouse |

### 3.3 Progress Persistence

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Save reading position | On pause, on page leave, or periodically — save `last_sentence_index` and `scroll_position` to `reading_progress` table via `PATCH /api/articles/[id]/progress` | User can resume where they left off |
| 2 | Restore reading position | On page load, fetch last position and scroll to it; optionally prompt "Resume from where you left off?" | Seamless continuation across sessions |
| 3 | Auto-mark as completed | When TTS reaches the last sentence or user scrolls to the bottom, prompt or auto-update status to `completed` | Articles naturally move to "Completed" |

**Phase 3 Deliverable:** User can listen to any article with synced highlighting, pause/resume, jump to any sentence, and resume later from where they stopped.

---

## Phase 4 — Authentication & Data Isolation

**Goal:** Add lightweight user identification so articles and progress are user-scoped.

### 4.1 Lightweight Auth (v1)

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Design `users` table | Columns: `id`, `session_token`, `created_at` | Schema updated |
| 2 | Add `user_id` FK to articles and progress tables | Migration to add foreign key; backfill existing data if needed | Data is user-scoped |
| 3 | Session token middleware | On first visit, generate a UUID token, set it as an HTTP-only cookie; on subsequent requests, read the cookie to identify the user | Users are silently identified |
| 4 | Scope all API queries by user | Every query filters by `user_id` from the session | Users only see their own articles |
| 5 | Add basic abuse prevention | Rate limit article creation per session (e.g., 50/day) | System can't be easily spammed |

**Phase 4 Deliverable:** Each browser session has isolated data. No login required, but articles are private per session.

---

## Phase 5 — Polish, Edge Cases & Deployment

**Goal:** Harden the app, handle edge cases, and deploy to production.

### 5.1 Error Handling & Edge Cases

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Handle extraction failures | Some URLs will fail (paywalls, SPAs, PDFs); show clear error with reason | User understands why an article couldn't be fetched |
| 2 | Handle empty/short articles | If extracted content is trivially short, warn the user | No confusing blank reader views |
| 3 | Handle duplicate URLs | If a user tries to add the same URL twice, redirect to the existing article | No duplicate entries |
| 4 | TTS unavailability | If the browser doesn't support Web Speech API, show a fallback message | App doesn't break on unsupported browsers |
| 5 | Network error handling | Retry logic or clear errors for failed API calls on the frontend | Graceful degradation on flaky connections |

### 5.2 UI Polish

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Responsive design pass | Test and fix layout on mobile (375px), tablet (768px), desktop (1440px) | App works well on all screen sizes |
| 2 | Dark mode | Implement theme toggle using Tailwind's dark mode (class strategy); persist preference in localStorage | Users can switch between light and dark themes |
| 3 | Transitions & micro-interactions | Smooth page transitions, button hover states, toast animations | App feels polished and intentional |
| 4 | Favicon & metadata | Add favicon, Open Graph tags, page titles | App looks professional in browser tabs and shares |
| 5 | Loading performance | Optimize images (next/image), minimize bundle, lazy-load non-critical components | Fast initial load and navigation |

### 5.3 Deployment

| # | Task | Details | Expected Outcome |
|---|------|---------|-------------------|
| 1 | Set up Vercel project | Connect GitHub repo to Vercel | Automatic deployments on push |
| 2 | Provision Vercel Postgres | Create database via Vercel dashboard; add connection string to environment variables | Production database ready |
| 3 | Run migrations on production | Execute `drizzle-kit migrate` against production DB | Schema is live |
| 4 | Environment variable audit | Ensure all secrets are in Vercel env vars, not in code | Secure configuration |
| 5 | Smoke test production | Manually test the full flow: add article, read, TTS, save, resume | Everything works end-to-end in production |

**Phase 5 Deliverable:** A deployed, polished, production-ready app at a public URL.

---

## Project Structure

```
simple-reader/
├── app/
│   ├── layout.tsx              # Root layout (fonts, global styles)
│   ├── page.tsx                # Home page (URL input)
│   ├── library/
│   │   └── page.tsx            # Article library with filters
│   ├── article/
│   │   └── [id]/
│   │       └── page.tsx        # Reader view
│   └── api/
│       └── articles/
│           ├── route.ts        # GET (list), POST (create)
│           └── [id]/
│               ├── route.ts    # GET, PATCH, DELETE
│               └── progress/
│                   └── route.ts # PATCH (save progress)
├── components/
│   ├── ui/                     # Generic UI components (Button, Input, Card, etc.)
│   ├── article-card.tsx        # Article list card
│   ├── reader-view.tsx         # Article reader component
│   ├── tts-controls.tsx        # TTS playback bar
│   ├── url-input.tsx           # URL submission component
│   └── nav.tsx                 # Navigation
├── lib/
│   ├── db.ts                   # Database connection
│   ├── article-extractor.ts    # URL → parsed article
│   ├── sentence-splitter.ts    # Text → sentence array
│   └── utils.ts                # Shared helpers
├── db/
│   ├── schema.ts               # Drizzle schema definitions
│   └── migrations/             # Generated SQL migrations
├── hooks/
│   ├── use-tts.ts              # TTS custom hook
│   └── use-reading-progress.ts # Progress tracking hook
├── types/
│   └── index.ts                # Shared TypeScript types
├── public/                     # Static assets
├── .env.local                  # Environment variables (git-ignored)
├── drizzle.config.ts           # Drizzle ORM config
├── tailwind.config.ts          # Tailwind config
├── tsconfig.json
└── package.json
```

---

## Development Order & Dependencies

```
Phase 1.1 (Scaffolding)
    │
    ├── Phase 1.2 (DB Schema) ──→ Phase 1.3 (APIs)
    │                                   │
    │                                   ▼
    ├────────────────────────── Phase 2.1 (Layout)
    │                                   │
    │                              Phase 2.2 (Library)
    │                                   │
    │                              Phase 2.3 (Reader) ──→ Phase 3.1 (TTS Engine)
    │                                                          │
    │                                                     Phase 3.2 (TTS UI)
    │                                                          │
    │                                                     Phase 3.3 (Progress)
    │                                                          │
    ├─────────────────────────────────────────────────── Phase 4 (Auth)
    │                                                          │
    └─────────────────────────────────────────────────── Phase 5 (Polish & Deploy)
```

---

## Key Technical Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| ORM | Drizzle | Type-safe, lightweight, great Vercel Postgres support |
| HTML sanitization | DOMPurify | Prevents XSS when rendering extracted article HTML |
| Sentence splitting | `Intl.Segmenter` (server-side) | Native API, handles edge cases better than regex |
| TTS | Web Speech API | Free, zero infra cost, adequate for personal use |
| Auth (v1) | Session cookie (UUID) | Simplest possible user isolation; no login friction |
| State management | React Server Components + client hooks | Minimal client-side state; leverage Next.js data fetching |

---

## Definition of Done (per phase)

- [ ] All tasks in the phase are complete
- [ ] No TypeScript errors (`npm run build` passes)
- [ ] No lint errors (`npm run lint` passes)
- [ ] Manual testing confirms the expected outcomes
- [ ] Code is committed with clear commit messages
