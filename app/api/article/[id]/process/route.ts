import { prisma } from "@/lib/prisma";
import { processUrl } from "@/lib/processing/url";
import { NextRequest, NextResponse } from "next/server";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const article = await prisma.article.findUnique({
    where: { id },
  });

  if (!article) {
    return NextResponse.json(
      { message: "Article not found" },
      { status: 404 }
    );
  }

  // Pasted articles are already READY
  if (article.sourceType === "pasted") {
    return NextResponse.json({ data: article }, { status: 200 });
  }

  // Idempotent: don't reprocess if already processing or ready
  if (article.status === "PROCESSING" || article.status === "READY") {
    return NextResponse.json({ data: article }, { status: 200 });
  }

  if (!article.url) {
    return NextResponse.json(
      { message: "Article has no URL to process" },
      { status: 400 }
    );
  }

  // Set status to PROCESSING
  console.log(`[process-route] Processing article ${id}, url: ${article.url}`);
  await prisma.article.update({
    where: { id },
    data: { status: "PROCESSING" },
  });

  try {
    const result = await processUrl(article.url);

    console.log(`[process-route] Result — isPaywalled: ${result.isPaywalled}, sections: ${result.sections.length}, errorMessage: ${result.errorMessage || "none"}`);

    if (result.isPaywalled || result.sections.length === 0) {
      console.log(`[process-route] Marking article ${id} as ERROR`);
      const updated = await prisma.article.update({
        where: { id },
        data: {
          status: "ERROR",
          errorMessage:
            result.errorMessage ||
            "Could not extract article content. The page may be paywalled or not an article.",
          title: result.title || null,
          siteName: result.siteName || null,
        },
      });

      return NextResponse.json(
        { data: updated, message: updated.errorMessage },
        { status: 422 }
      );
    }

    const updated = await prisma.article.update({
      where: { id },
      data: {
        status: "READY",
        title: result.title,
        excerpt: result.excerpt,
        siteName: result.siteName,
        sections: result.sections as object[],
        media: result.media as object[],
        errorMessage: null,
      },
    });

    console.log(`[process-route] Article ${id} processed successfully — "${result.title}"`);
    return NextResponse.json({ data: updated }, { status: 200 });
  } catch (err) {
    console.error(`[process-route] Error processing article ${id}:`, err);
    const errorMessage =
      err instanceof Error
        ? err.message
        : "Could not fetch or parse the article. Please try a different URL.";

    const updated = await prisma.article.update({
      where: { id },
      data: {
        status: "ERROR",
        errorMessage,
      },
    });

    return NextResponse.json(
      { data: updated, message: errorMessage },
      { status: 422 }
    );
  }
}
