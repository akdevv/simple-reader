import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") || "12", 10)));
  const sortBy = searchParams.get("sort_by") === "old" ? "asc" : "desc";
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {
    userId: "anonymous",
  };

  if (status === "read") {
    where.readStatus = "READ";
  } else if (status === "unread") {
    where.readStatus = "UNREAD";
  } else if (status === "favourite") {
    where.isFavourite = true;
  } else if (status === "not-favourite") {
    where.isFavourite = false;
  }

  const [total, articles] = await Promise.all([
    prisma.article.count({ where }),
    prisma.article.findMany({
      where,
      orderBy: { createdAt: sortBy as "asc" | "desc" },
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
