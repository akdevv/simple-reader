# Simple Reader

Save articles from URLs or paste text directly. Read them in a clean, distraction-free view. Listen to them with AI-generated text-to-speech.

![Simple Reader](public/screenshot.png)

## Features

- **Save from URL** — extracts article content using Mozilla Readability
- **Paste text** — supports markdown and plain text
- **Text-to-Speech** — generates audio using Kokoro-82M (runs locally, no API keys)
- **Code blocks** — syntax highlighted with Shiki
- **Search, filter, sort** — find articles by title, filter by read status or favourites

## Requirements

- Docker and Docker Compose
- pnpm (if running outside Docker)

## Run Locally

```bash
docker compose up -d --build
```

Or via pnpm:

```bash
pnpm docker:start
```

Open [localhost:3000](http://localhost:3000). PostgreSQL, the Next.js app, and TTS all run from this single command.

### Development mode

```bash
cp .env.example .env
docker compose up -d postgres       # start just the database
pnpm install
pnpm prisma generate
pnpm prisma migrate deploy
pnpm dev
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router), React 19, TypeScript |
| Styling | Tailwind v4, shadcn/ui |
| Database | PostgreSQL 16, Prisma 7.3 |
| Article extraction | Mozilla Readability, JSDOM |
| Text-to-Speech | Kokoro-82M via kokoro-js + onnxruntime-node |
| Code highlighting | Shiki |

### How it works

1. User submits a URL or pastes text
2. URLs are fetched, cleaned (popup removal, paywall detection), and parsed with Readability
3. Content is split into typed sections (paragraphs, headings, code blocks, tables, lists, images, videos, blockquotes)
4. Sections are stored as JSON in PostgreSQL
5. TTS spawns a Node.js child process that runs Kokoro-82M locally — the ONNX model (~92MB) auto-downloads on first use
6. Audio is saved as WAV and served statically with sentence-level alignment for highlighted playback

### TTS configuration

Set these environment variables to customize TTS (all optional):

| Variable | Default | Description |
|----------|---------|-------------|
| `KOKORO_VOICE` | `af_heart` | Voice name |
| `KOKORO_SPEED` | `1` | Speech speed |
| `KOKORO_DTYPE` | `q8` | Model precision |
