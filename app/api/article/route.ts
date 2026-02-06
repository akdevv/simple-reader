import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { url } = await request.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json(
      { message: "URL is required" },
      { status: 400 }
    );
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NextResponse.json(
      { message: "Please enter a valid URL" },
      { status: 400 }
    );
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    return NextResponse.json(
      { message: "Only http and https URLs are supported" },
      { status: 400 }
    );
  }

  const article = await prisma.article.create({
    data: {
      url: parsed.toString(),
      userId: "anonymous",
    },
  });

  return NextResponse.json({ data: { id: article.id } }, { status: 200 });
}
