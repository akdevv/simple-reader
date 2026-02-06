import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

/** Toggle mock behavior: "success" populates article with mock data; "fail" sets ERROR + message. */
const MOCK_CASE: "success" | "fail" = "fail";

const MOCK_ARTICLE = {
  title: "The Future of Reading: How AI Is Reshaping Long-Form Content",
  excerpt:
    "A deep dive into how machine learning and natural language processing are changing the way we consume and interact with articles, essays, and books.",
  siteName: "Tech Insights Blog",
  sections: [
    { type: "paragraph", content: "In the past decade, the way we read has transformed dramatically. From e-readers to audiobooks to AI-powered summarization, technology continues to reshape our relationship with long-form content." },
    { type: "heading", content: "The Rise of Smart Summaries" },
    { type: "paragraph", content: "Tools that can distill a 5,000-word article into a few bullet points are no longer science fiction. Readers can now choose how deep they want to go—from a quick skim to a full immersion." },
    { type: "heading", content: "What Stays the Same" },
    { type: "paragraph", content: "Despite these changes, the core desire remains: people still want to understand, learn, and feel connected to ideas. The best technology serves that desire without replacing the joy of getting lost in a good piece of writing." },
  ] as { type: string; content: string }[],
  media: [
    { url: "https://example.com/og-image.jpg", alt: "Article hero image" },
  ] as { url: string; alt?: string }[],
};

export async function POST(
  _request: NextRequest,
  { params }: { params: { id: string } }
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

  // Idempotent: don't reprocess if already processing or ready
  if (article.status === "PROCESSING" || article.status === "READY") {
    return NextResponse.json({ data: article }, { status: 200 });
  }

  // Simulate processing time
  await new Promise((resolve) => setTimeout(resolve, 5000));

  if (MOCK_CASE === "fail") {
    await prisma.article.delete({ where: { id } });
    return NextResponse.json(
      { message: "Could not fetch or parse the article. Please try again with a different URL." },
      { status: 422 }
    );
  }

  // Success: populate with mock data and set READY
  const updated = await prisma.article.update({
    where: { id },
    data: {
      status: "READY",
      title: MOCK_ARTICLE.title,
      excerpt: MOCK_ARTICLE.excerpt,
      siteName: MOCK_ARTICLE.siteName,
      sections: MOCK_ARTICLE.sections as object,
      media: MOCK_ARTICLE.media as object,
    },
  });

  return NextResponse.json({ data: updated }, { status: 200 });
}
