import { NextRequest, NextResponse } from "next/server";
import { stat, createReadStream } from "fs";
import { join } from "path";
import { Readable } from "stream";

const AUDIO_DIR = join(process.cwd(), "public", "audio");

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const filePath = join(AUDIO_DIR, ...path);

  // Prevent directory traversal
  if (!filePath.startsWith(AUDIO_DIR)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  const fileStat = await new Promise<import("fs").Stats | null>((resolve) => {
    stat(filePath, (err, stats) => resolve(err ? null : stats));
  });

  if (!fileStat || !fileStat.isFile()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const stream = createReadStream(filePath);
  const webStream = Readable.toWeb(stream) as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": fileStat.size.toString(),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
