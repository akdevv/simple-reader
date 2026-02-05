# simple-reader

## Article Reader with Synced Text-to-Speech

## 1. Core Idea

This project is a **minimal, distraction-free web app** designed to help me read and listen to online articles more comfortably.

The app allows a user to:

- Paste a link to any article or blog post
- Extract and display the article in a clean, readable UI
- Listen to the article using synced text-to-speech
- Save articles to read now or read later
- Track reading progress and history

The goal is **not** to build a full-fledged product or content platform, but a **personal utility** that removes friction from reading long-form content online.  
The focus is on **clarity, speed, and usability**, with no unnecessary features or distractions.

---

## 2. Features

### 2.1 Complete Feature List (Planned)

- Fetch and extract article content from a URL
- Clean reader-style article view
- Automatic transcript generation (sentence-based)
- Synced text-to-speech playback
- Play / pause controls
- Jump to sentence or section
- Save articles (read now / read later)
- Mark articles as read
- Reading history
- Simple search and filters (by status)

---

## 2.2 Feature Breakdown & Scope

### 2.2.1 Article Fetching & Extraction

**What it does**

- Takes an article URL as input
- Fetches the webpage HTML
- Extracts the main readable content (title, text, images)

**Scope**

- Uses a readability parser to remove ads, navigation, and clutter
- No manual editing or corrections in v1
- Works best for blogs, news articles, and long-form posts

---

### 2.2.2 Clean Reader View

**What it does**

- Displays the extracted article in a distraction-free layout
- Optimized typography for long reading sessions

**Scope**

- Single-column layout
- Responsive for desktop and mobile
- Supports inline images
- Optional dark mode (if time permits)

---

### 2.2.3 Transcript Generation

**What it does**

- Converts article text into a structured list of sentences
- Each sentence acts as a unit for highlighting and TTS sync

**Scope**

- Sentence splitting happens automatically
- No manual transcript editing
- Stored as structured data for reuse (TTS, progress tracking)

---

### 2.2.4 Synced Text-to-Speech (TTS)

**What it does**

- Reads the article aloud sentence by sentence
- Highlights the currently spoken sentence in the UI

**Scope (v1)**

- Play / pause support
- Sentence-level highlighting
- Jump to sentence or section
- Audio is generated or spoken dynamically (not stored)

**Out of scope (v1)**

- Downloadable audio
- Offline playback
- Voice customization beyond basic options

---

### 2.2.5 Save Articles (Read Now / Read Later)

**What it does**

- Allows articles to be saved for future reading
- Tracks reading state

**Scope**

- Save article metadata and extracted content
- Status states:
  - Reading
  - Saved for later
  - Completed
- No folders or tags in v1

---

### 2.2.6 Reading History

**What it does**

- Displays previously read and saved articles

**Scope**

- Simple list views:
  - Ongoing
  - Saved
  - Completed
- Basic text search
- Basic filters by status
- No analytics or reading stats in v1

---

## 3. Tech Stack

### 3.1 Frontend

- **Next.js (App Router)** – UI + server integration
- **React** – component-based UI
- **Tailwind CSS** – fast, clean styling
- **Web Speech API (initially)** – browser-based TTS

---

### 3.2 Backend

- **Next.js Route Handlers** – API endpoints
- **Article extraction**: Mozilla Readability or equivalent
- **Sentence segmentation**: server-side text processing

---

### 3.3 Database

- **Vercel Postgres** (preferred for simplicity)
  - Stores articles, transcripts, and reading state
- Can be replaced or expanded later without major refactor

---

### 3.4 Authentication (Minimal / V1)

- Lightweight user identification (cookie or token-based)
- Purpose:
  - Save articles
  - Track reading history
  - Prevent abuse
- Full auth system is **explicitly a v2 feature**

---

### 3.5 Text-to-Speech (TTS) Options

#### Recommended (Best Value for Money)

- **Cloud-based neural TTS (sentence-based generation)**
  - High-quality voices
  - Predictable cost per character
  - Easy to integrate later for saved audio

This is suitable once audio persistence is introduced.

#### Free / Low-Cost Alternatives (V1)

- **Browser Web Speech API**
  - Free
  - Zero backend cost
  - Good enough for personal use
  - Voice quality depends on device/browser

**V1 Decision**

- Start with browser-based TTS
- Upgrade to cloud TTS only if audio storage or quality becomes important

---

## 4. Project Timeline (High-Level)

| Phase   | Focus                        | Time     |
| ------- | ---------------------------- | -------- |
| Phase 1 | Article fetching + reader UI | 1–2 days |
| Phase 2 | Transcript + synced TTS      | 2 days   |
| Phase 3 | Save articles + history      | 1–2 days |
| Phase 4 | Polish + deployment          | 1 day    |

**Total Estimated Time:** ~5–7 focused days

---

## Summary

This project is intentionally **small, focused, and personal**.  
Success is defined by:

- Daily usability
- Clean reading experience
- Reliable synced audio playback

Anything beyond that is optional and belongs to future iterations.
