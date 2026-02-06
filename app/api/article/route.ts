import { Article } from "@/lib/types/article";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const { url } = await request.json();
  console.log(url);

  // 3 second delay
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const mockArticleData: Article = {
    id: `article-${Date.now()}`,
    userId: "user-7f8a9b2c",
    url: url,
    title: "The Future of Artificial Intelligence in Software Development",
    content:
      "Artificial intelligence is rapidly transforming the software development landscape. From code completion tools to automated testing frameworks, AI-powered solutions are becoming integral to modern development workflows. This article explores how machine learning models are being integrated into IDEs, the rise of AI pair programming assistants, and the ethical considerations developers must keep in mind. We'll examine real-world case studies from companies that have successfully implemented AI tools, discuss the potential impact on junior developers entering the field, and look ahead to what the next decade might bring. The key takeaway is that AI won't replace developers—instead, it will augment their capabilities, allowing them to focus on higher-level problem-solving and creative solutions while automating repetitive tasks.",
    createdAt: new Date(),
  };

  return NextResponse.json({ data: mockArticleData }, { status: 200 });
}
