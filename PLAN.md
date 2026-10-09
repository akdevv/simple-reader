# Simple Reader — Build Plan

Two products, one codebase:

- **Web app**: a personal article archive. Paste links, and each one is
  saved with its full content, auto-categorized and tagged. Search across
  everything, filter by category/tag/site, fix categories and tags by hand.
  Open any article in a clean reading view, press play to hear it with
  sentence highlighting, and pick up where you left off. Highlight passages
  and attach notes. Search by meaning, not only exact words. Needs an account.
- **Extension**: on any page, click the icon to open a clean reader overlay
  with the same audio and highlighting. Reading needs no account, and nothing
  leaves the browser. If you're signed in to the web app, a "Save to Simple
  Reader" button sends the page to your archive.

Audio has one voice. Speed is the only setting (0.75x-2x).

`old-code/` is reference only. Port pieces from it, never edit it.

---

## Decisions

| Area                 | Choice                                                                                                                                    | Why                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Repo                 | pnpm workspaces monorepo                                                                                                                  | web + extension share extraction, sentences and TTS                                                  |
| Web framework        | Astro (server output) on Vercel (`@astrojs/vercel`)                                                                                       | landing page is already Astro; SSR pages + Actions cover the app without a SPA                       |
| Backend              | Astro Actions + API routes in the same app, deployed as Vercel functions (Node runtime)                                                   | no separate server: one repo, one `git push` deploy                                                  |
| Interactivity        | vanilla TS `<script>`s, no React                                                                                                          | the only rich UI is the reader + player, which the extension must run as vanilla anyway              |
| DB                   | Neon Postgres (Vercel Marketplace) + Drizzle                                                                                              | one-click from the Vercel dashboard, env vars injected, free tier fits                               |
| Auth                 | Better Auth, email + password (no verification); Google + GitHub parked until credentials exist; DB-backed per-IP rate limits             | a library inside the app, not a hosted service; users live in our Postgres; no email provider needed |
| Extraction           | `@mozilla/readability`                                                                                                                    | runs on the live DOM in the extension, and on `linkedom` in the server function                      |
| Sanitizing           | `sanitize-html` on the server before storing                                                                                              | extracted HTML is untrusted and gets rendered on our origin                                          |
| TTS                  | local Piper (`@mintplex-labs/piper-tts-web` + `onnxruntime-web@1.18.0` pinned) in a Web Worker                                            | free, private, proven in `ext-reference`                                                             |
| Highlighting         | CSS Custom Highlight API                                                                                                                  | no DOM mutation, same code on both sides                                                             |
| Search               | Postgres full-text search (generated `tsvector` + GIN index) combined with semantic search (`pgvector`), merged by reciprocal rank fusion | both built into Neon, no search service to run or sync                                               |
| Embeddings           | `@huggingface/transformers` running `all-MiniLM-L6-v2` (384 dims) inside the server function                                              | free, no API, no key; the model ships with the app                                                   |
| Highlights + notes   | quote + char offsets into the stored article text, drawn with the CSS Custom Highlight API                                                | stored content never changes, so offsets stay valid; same highlight code as TTS                      |
| Extension → web auth | the extension calls the web app with the browser's existing session cookie (`credentials: 'include'`)                                     | no tokens or login screen in the extension; sign in on the website once                              |
| Auto-categorize      | one Gemini call per saved article (plain `fetch` to its OpenAI-compatible endpoint, JSON mode, model set by `GEMINI_MODEL`)               | free tier; picks from the user's own category list + suggests tags; runs after the save responds     |
| Extension build      | Vite + CRXJS, MV3                                                                                                                         | proven in `ext-reference`                                                                            |
| Styling              | Tailwind v4 (web), plain CSS in shadow DOM (extension overlay)                                                                            | the overlay has to be isolated from page CSS                                                         |

Portability: the app is plain Astro + Postgres. To leave Vercel, swap the
adapter (Node, Netlify, Cloudflare) and point `DATABASE_URL` at any Postgres.

---

## Repo layout

```
apps/
  web/          Astro on Vercel: landing + /app (library, reader, notes), actions, auth, /api/save
  extension/    CRXJS: popup, background, content (overlay), offscreen (TTS)
packages/
  core/         shared, framework-free TS
    sentences.ts    splitter (port old-code/extension + tests)
    extract.ts      Readability wrapper → { title, byline, site, excerpt, publishedAt, html, text }
    segment.ts      rendered article DOM → sentences + Ranges
    highlight.ts    CSS.highlights set/clear + scroll into view
    tts/worker.ts   Piper inference (port ext-reference tts-worker)
    tts/player.ts   queue, generate-ahead, <audio>, cache, ReaderState
    reader.ts       render article + wire player/highlight/keys/click-to-seek
    notes.ts        selection → {start, end, quote}; offsets → Range (reuses segment.ts's char map)
```

`reader.ts` is the key idea: a single vanilla function
`mountReader(container, article, player)`. The web reader page calls it. The
extension overlay calls it inside a shadow root. Both get the same reading
experience.

---

## Data model (web)

Better Auth tables (`user`, `session`, `account`, `verification`) plus:

```
article
  id, userId, url, title, byline, siteName, excerpt, publishedAt,
  contentHtml (sanitized), contentText (plain, for search + AI), wordCount,
  categoryId -> category, categorySource ('auto' | 'manual'),
  tags text[],
  position (sentence index), status ('unread' | 'reading' | 'done'),
  source ('web' | 'extension'),
  createdAt, updatedAt
  search tsvector GENERATED ALWAYS AS
    (title weight A, siteName + byline B, contentText C) STORED
  embedding vector(384)            -- null until computed
  GIN(search), GIN(tags), HNSW(embedding), unique(userId, url)

category
  id, userId, name, unique(userId, name)

highlight
  id, userId, articleId -> article (cascade delete),
  start, end (char offsets into the rendered article text), quote,
  note (nullable), createdAt, updatedAt
  search tsvector GENERATED (quote + note), GIN(search)
```

- Content is stored in full, so an article stays readable after its original
  page disappears.
- Tags are a `text[]` column, not a join table. Filtering uses `tags @> '{x}'`.
  Renaming a tag is one `array_replace` UPDATE.
- Categories get a table because the user manages the list and the AI picks
  from it. New users start with: Tech, Science, Business, Culture, Politics,
  Health, Design, Other.
- One embedding per article (title + excerpt + opening text). Good enough to
  find articles by topic. Long articles about several things would need a
  per-chunk table; add that only if search misses them.

---

## Phases

Web app first (phases 0-8), then the extension (9-11). Phases 1-2 build the
shared core the web reader needs, so the extension reuses it later.
Every phase ends with something you can run.

### 0. Scaffold

pnpm workspace, shared tsconfig base, ESLint (flat config) + Prettier at the
root. `packages/core`: shared types + one stub file per module, vitest.
`apps/web`: Astro + Tailwind v4 + Vercel adapter (`output: "server"`), a
"coming soon" page for every route, `/api/save` returning 501.
`apps/extension`: CRXJS + Vite + Tailwind popup, with background, content
script and offscreen doc stubs. Message and settings types are ported.
✅ `pnpm -r build` and `pnpm -r test` pass.

### 1. Core: text

Port `sentences.ts` with its tests. Write `extract.ts`, which takes a
`Document` so it works on both the live DOM and linkedom. Write
`segment.ts`: port the char→(textNode, offset) mapping from
`ext-reference/src/content/main.ts` and point it at the rendered article
instead of the raw page. Port `highlight.ts`.
✅ Unit tests: splitter edge cases (Dr., 3.14, e.g.), and extract + segment on
a saved HTML fixture.

### 2. Core: TTS player

Port `tts-worker.ts` and the logic from `ext-reference/src/offscreen/main.ts`
into `player.ts`, with the `chrome.*` calls removed. The player takes texts and
emits `ReaderState`. Keep the session counter (drops stale generation), the
Cache API wav cache and setting `playbackRate` on every play. Pin ort threads
to 1.
✅ A tiny dev HTML page in `core` plays a paragraph with highlighting.

### 3. Web: foundation

Move the landing page from `old-code/web`. Add the Vercel adapter, Neon via
the Vercel Marketplace (local dev: `docker compose up -d`), Drizzle migrations,
Better Auth (email + password; Google/GitHub switch on once their env vars
are set). Rate limits per IP, stored in Postgres: sign-in 5/min, sign-up
3/hour, everything else 100/min. `/app/*` requires a session. Env vars:
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GEMINI_API_KEY`,
`GEMINI_MODEL`, optional Google + GitHub client id/secret.
✅ `pnpm dev` locally against the Neon dev branch, sign in, see an empty library.
Connect the repo to Vercel with root `apps/web`, and preview deploys work.

### 4. Web: save + read

- Astro Action `saveArticle(url)`: fetch (http/https only, 10s timeout,
  5MB cap, must be HTML) → linkedom → `extract` → `sanitize-html` → insert (html + plain text).
  Duplicate URL returns the existing article.
- `/app`: library list (unread / done), delete, mark done. Search and filters come in phase 5.
- `/app/a/[id]`: SSR the sanitized HTML, then `mountReader` + player in the
  browser. Save `position` (debounced) as sentences advance. On open, resume
  from `position`. Speed is kept in `localStorage`.
  ✅ Paste a link, read it, press play, close the tab, reopen, it resumes.

### 5. Web: archive

- **Bulk add**: the save box accepts many links, one per line (max 20 per
  submit, processed in order, each reports saved / duplicate / failed).
- **Auto-categorize**: after the insert, `waitUntil` (from
  `@vercel/functions`) runs one Gemini call on title + site + excerpt + the
  opening of `contentText`. JSON mode, asking for
  `{ category: string, tags: string[] }`. Validate the reply: a category not in
  the user's list becomes "Other", and tags are lowercased, deduped and capped at 5.
  The prompt lists the user's existing tags so it reuses them instead of
  inventing near-duplicates.
  - Writes only when `categorySource = 'auto'`. Any manual change sets
    `'manual'`, and auto never overwrites it.
  - Suggested tags are merged in once, at save. After that, tags are only
    changed by hand.
  - No `GEMINI_API_KEY`, a rate limit (429) or any failure: the article lands
    in "Other" with no tags. Saving never fails because of the AI step.
  - "Re-categorize" button per article: resets to `auto` and reruns.
- **Tags + categories UI**: edit on the article page (chips + input with
  autocomplete from existing tags). Manage page: rename/merge/delete tags and
  categories.
- **Search + filters**: `/app?q=&category=&tag=&site=&status=` (GET params,
  so every view is a bookmarkable URL). `websearch_to_tsquery` (supports
  "quotes" and -exclude), ranked by `ts_rank`, with `ts_headline` snippets.
  Sort: newest / oldest / relevance.
  ✅ Paste 10 links, and they land categorized and tagged. Override one
  category, re-save the same link, and the override holds. Search for a phrase
  from the middle of an article and it shows up with a snippet.

### 6. Web: highlights + notes

- In the reader, selecting text shows a small popover: **Highlight** or
  **Add note**. `notes.ts` turns the selection into `{start, end, quote}`
  offsets over the article text. It reuses the char map from `segment.ts`.
- On load, offsets become Ranges and are drawn with `CSS.highlights`
  (`sr-note`, separate from the TTS `sr-sentence`, so both show at once).
  If the quote doesn't match at the offsets, find it with `indexOf(quote)`.
  This can't normally happen, because stored content never changes.
- Click a highlight to edit its note or delete it. This uses the same
  point → Range lookup as click-to-seek.
- `/app/notes?q=`: every highlight and note across the archive, grouped by
  article, searchable (FTS on quote + note), each linking back to the exact
  spot.
- "Copy highlights as Markdown" per article.
  ✅ Highlight 3 passages, add a note to one, reload, and all 3 are there.
  Search a word from the note on `/app/notes` and it's found. Play audio over a
  highlighted passage and both highlights show.

### 7. Web: semantic search

- **Checked (2026-10-10):** function is 78MB once non-linux onnxruntime binaries are excluded; model (23MB, q8) downloads to /tmp on a cold instance in ~3.5s, then loads in <100ms. Originally: confirm the transformers.js + model bundle fits
  Vercel's 250MB function limit and cold-starts in a few seconds. If not,
  compute embeddings in the browser instead: the web app embeds on save and
  on search, and the model is cached like the Piper voice.
- Embed after save in the same `waitUntil` as categorizing. A failure leaves
  `embedding` null, and a "backfill" script catches up on nulls.
- Search runs both queries (FTS top 50, vector top 50 by cosine) and merges
  them with reciprocal rank fusion in one SQL statement. There's one search
  box and no mode switch. Exact phrases still win through FTS.
- "Related articles" on each article page: top 5 by cosine. It's free once
  vectors exist.
  ✅ Save an article about "sleep", search "rest and recovery", and it comes up.
  Related articles show on the reader page.

### 8. Ship the web app

Promote to production on Vercel, then run migrations against the prod DB
(`CREATE EXTENSION vector`). Point the landing page "Open app" CTA at the
real URL. The web app is fully usable on its own from here.

### 9. Extension: reader overlay

- Popup: "Read this page" + player controls (port `ext-reference/src/popup`).
- Content script: `extract` on the live document → open a shadow-DOM overlay →
  `mountReader`. Esc closes it.
- Audio still runs in the offscreen doc because of page CSP and MV3. The
  content script sends sentences, the offscreen doc runs `player.ts`, and
  state flows back over the existing message design (`ext-reference/src/shared/messages.ts`).
- Settings: `{ speed }` only, in `chrome.storage.local`, pushed to offscreen.
  ✅ Load unpacked, open any article, overlay shows, audio plays, highlight
  follows, space/←/→ work, clicking a sentence jumps.

### 10. Extension: save to Simple Reader

- Manifest: `host_permissions` for the web app origin only. A fixed `key`
  gives the extension the same ID in dev and prod. Better Auth
  `trustedOrigins` includes `chrome-extension://<id>`.
- Popup asks the background to call `GET <app>/api/auth/get-session` with
  `credentials: 'include'`. The browser attaches the site's session cookie.
  Signed in: show **Save to Simple Reader**. Not signed in: **Sign in** opens
  the web app in a tab. The extension stores no tokens.
- Save: the content script extracts from the live DOM (works on paywalled
  and JS-rendered pages the server can't fetch) → background `POST
<app>/api/save` with `{ url, title, byline, siteName, excerpt, html }`.
- Astro's `checkOrigin` rejects cross-site _form_ POSTs. The extension sends
  JSON, so it passes, but keep the request `application/json`.
- **The server treats this as untrusted input:** it checks the session and
  the origin, caps the body at 5MB, runs `sanitize-html` and derives
  `contentText` from the sanitized HTML itself. After that, it's the same
  pipeline: dedupe, categorize, embed. The reply links to the article.
- Popup shows "Saved ✓ · Open in archive", or "Already saved".
  ✅ Signed out: the popup offers sign-in. Sign in on the site, reopen the popup,
  Save. The article appears in the archive, categorized, with content from the
  live page.

### 11. Ship the extension

Package the extension zip for the Chrome Web Store. Privacy policy: reading
is fully local, and a page is sent to your archive only when you press Save
while signed in. Point the landing page "Add to Chrome" CTA at the store
listing.

---

## Not in v1 (add when asked for)

- Firefox build (CRXJS supports it, but the offscreen API is Chrome-only).
- Email verification, password reset, magic links. Add Resend's free plan when someone needs it.
- Google + GitHub sign-in: code is in, set the env vars to turn them on.
- Import (Pocket/Instapaper export, browser bookmarks HTML).
- Highlights/notes inside the extension overlay (web app only for now).
- Archiving images: images are hotlinked and can break later. Copy them into
  Vercel Blob when that matters.
- Paywalled or JS-rendered pages on the web side. Server fetch sees what curl
  sees. Use the extension's Save button for those.

## Risks

- **Server fetch gets blocked** (Cloudflare bot checks, paywalls): show a clear
  error and suggest the extension's Save button.
- **Gemini free tier limits**: a bulk add can hit the per-minute limit. Those
  articles fall back to "Other", and "Re-categorize" fixes them later. Gemini's
  model names change over time, which is why the model is an env var.
- **Extension cookies**: some browsers or privacy settings may not send the
  session cookie on extension requests. Test this at the start of phase 10.
  Fallback: after sign-in, the site passes a Better Auth bearer token to the
  extension (`bearer` plugin), stored in `chrome.storage.local`.
- **Embedding model size on Vercel**: see phase 7. The browser fallback is ready.
- **~60MB voice download** (`en_US-hfc_female-medium`; "low" voices break on some words) on first play: show progress (already in the old popup).
- **ort/Piper on Vite 8**: pinned versions from `ext-reference`. Check them in
  phase 2 before building on top.
