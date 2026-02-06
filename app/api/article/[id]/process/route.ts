import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

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

  // TODO: Implement actual article fetching and parsing here.
  // For now, just return the article as-is (stays PENDING).
  return NextResponse.json({ data: article }, { status: 200 });
}
