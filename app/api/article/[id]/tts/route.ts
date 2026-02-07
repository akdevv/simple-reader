import { prisma } from "@/lib/prisma";
import { generateTtsAudio } from "@/lib/audio/kokoro-tts";
import { splitSentences } from "@/lib/utils/split-sentences";
import { ArticleSection } from "@/lib/types/article";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const article = await prisma.article.findUnique({ where: { id } });

  if (!article) {
    return NextResponse.json(
      { message: "Article not found" },
      { status: 404 },
    );
  }

  if (!article.sections) {
    return NextResponse.json(
      { message: "Article has no sections" },
      { status: 400 },
    );
  }

  const force = new URL(_request.url).searchParams.get("force") === "true";

  // Idempotent: don't re-generate if already processing or ready (unless forced)
  if (!force && (article.status === "TTS_PROCESSING" || article.status === "TTS_READY")) {
    return NextResponse.json({ data: article }, { status: 200 });
  }

  // Only proceed if article content is ready or TTS_READY (for force re-gen)
  if (article.status !== "READY" && article.status !== "TTS_READY") {
    return NextResponse.json(
      { message: "Article must be in READY or TTS_READY status for TTS generation" },
      { status: 400 },
    );
  }

  // Set status to TTS_PROCESSING
  console.log(`[tts-route] Starting TTS generation for article ${id}`);
  await prisma.article.update({
    where: { id },
    data: { status: "TTS_PROCESSING" },
  });

  try {
    const sections = article.sections as unknown as ArticleSection[];
    const sentences = splitSentences(sections);

    if (sentences.length === 0) {
      console.log(`[tts-route] No speakable content for article ${id}`);
      await prisma.article.update({
        where: { id },
        data: { status: "READY" },
      });
      return NextResponse.json(
        { data: article, message: "No speakable content found" },
        { status: 200 },
      );
    }

    // Store total sentence count so frontend can show progress immediately
    await prisma.article.update({
      where: { id },
      data: { ttsAudio: { progress: { current: 0, total: sentences.length } } },
    });

    // Throttle DB progress updates to avoid excessive writes
    let lastProgressUpdate = 0;
    const result = await generateTtsAudio(sentences, id, async (progress) => {
      const now = Date.now();
      const isLast = progress.current === progress.total;
      if (!isLast && now - lastProgressUpdate < 2000) return;
      lastProgressUpdate = now;
      await prisma.article.update({
        where: { id },
        data: {
          ttsAudio: { progress: { current: progress.current, total: progress.total } },
        },
      });
    });

    const ttsAudio = {
      audioUrl: result.audioUrl,
      sentences: result.sentences,
      alignments: result.alignments,
      totalDuration: result.totalDuration,
    };

    const updated = await prisma.article.update({
      where: { id },
      data: {
        status: "TTS_READY",
        ttsAudio: ttsAudio as object,
      },
    });

    console.log(
      `[tts-route] TTS generation complete for article ${id} (${result.totalDuration}s)`,
    );
    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err) {
    console.error(`[tts-route] Error generating TTS for article ${id}:`, err);

    // Revert to READY — article content is still valid
    await prisma.article.update({
      where: { id },
      data: { status: "READY" },
    });

    const errorMessage =
      err instanceof Error ? err.message : "TTS generation failed";
    return NextResponse.json(
      { data: article, message: errorMessage },
      { status: 422 },
    );
  }
}
