import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const q = searchParams.get("q")?.trim();
  if (!q) {
    return NextResponse.json(
      { message: "Search query is required" },
      { status: 400 }
    );
  }

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));

  const where = {
    userId: "anonymous" as const,
    title: {
      contains: q,
      mode: "insensitive" as const,
    },
  };

  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      omit: {
        sections: true,
        ttsAudio: true,
      },
    }),
  ]);

  return NextResponse.json(
    {
      data: articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    },
    { status: 200 }
  );
}
