import { prisma } from "@/lib/prisma";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
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

  return NextResponse.json({ data: article }, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();

  const updateData: Record<string, unknown> = {};

  if ("isFavourite" in body) {
    if (typeof body.isFavourite !== "boolean") {
      return NextResponse.json(
        { message: "Invalid value for 'isFavourite'" },
        { status: 400 }
      );
    }
    updateData.isFavourite = body.isFavourite;
  }

  if ("readStatus" in body) {
    if (body.readStatus !== "READ" && body.readStatus !== "UNREAD") {
      return NextResponse.json(
        { message: "Invalid value for 'readStatus'" },
        { status: 400 }
      );
    }
    updateData.readStatus = body.readStatus;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json(
      { message: "No valid fields to update" },
      { status: 400 }
    );
  }

  try {
    const article = await prisma.article.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({ data: article }, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Article not found" },
      { status: 404 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await prisma.article.delete({
      where: { id },
    });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch {
    return NextResponse.json(
      { message: "Article not found" },
      { status: 404 }
    );
  }
}
