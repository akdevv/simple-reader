import { prisma } from "@/lib/prisma";
import { processText } from "@/lib/processing/text-processor";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();

  // URL flow
  if (body.url) {
    const url = body.url;
    if (typeof url !== "string") {
      return NextResponse.json(
        { message: "URL must be a string" },
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

    if (parsed.protocol !== "https:") {
      return NextResponse.json(
        { message: "Only HTTPS URLs are supported" },
        { status: 400 }
      );
    }

    const article = await prisma.article.create({
      data: {
        url: parsed.toString(),
        sourceType: "url",
        userId: "anonymous",
      },
    });

    return NextResponse.json({ data: { id: article.id } }, { status: 200 });
  }

  // Text/content flow
  if (body.content) {
    const content = body.content;
    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { message: "Please paste or enter some content" },
        { status: 400 }
      );
    }

    const format =
      body.format === "plain" || body.format === "markdown"
        ? body.format
        : undefined;

    const result = await processText(content, format);

    const article = await prisma.article.create({
      data: {
        url: null,
        sourceType: "pasted",
        userId: "anonymous",
        status: "READY",
        title: typeof body.title === "string" && body.title.trim()
          ? body.title.trim()
          : result.title,
        excerpt: result.excerpt,
        sections: result.sections as object[],
        media: result.media as object[],
      },
    });

    return NextResponse.json({ data: { id: article.id } }, { status: 200 });
  }

  return NextResponse.json(
    { message: "Either 'url' or 'content' is required" },
    { status: 400 }
  );
}
