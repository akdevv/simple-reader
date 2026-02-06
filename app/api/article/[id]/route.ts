import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
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

  return NextResponse.json({ data: article }, { status: 200 });
}
