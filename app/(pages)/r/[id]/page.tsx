import { Article } from "@/lib/types/article";
import { notFound } from "next/navigation";

// This would typically fetch from your database
// For now, we'll use a mock store that would be replaced with actual DB calls
async function getArticle(id: string): Promise<Article | null> {
  // TODO: Replace with actual database fetch
  // For now, return mock data to demonstrate the UI
  const mockArticle: Article = {
    id: id,
    userId: "user-456",
    url: "https://example.com/article",
    title: "The Future of Artificial Intelligence in Software Development",
    content:
      "Artificial intelligence is rapidly transforming the software development landscape. From code completion tools to automated testing frameworks, AI-powered solutions are becoming integral to modern development workflows.\n\nThis article explores how machine learning models are being integrated into IDEs, the rise of AI pair programming assistants, and the ethical considerations developers must keep in mind.\n\nWe'll examine real-world case studies from companies that have successfully implemented AI tools, discuss the potential impact on junior developers entering the field, and look ahead to what the next decade might bring.\n\nThe key takeaway is that AI won't replace developers—instead, it will augment their capabilities, allowing them to focus on higher-level problem-solving and creative solutions while automating repetitive tasks.",
    createdAt: new Date(),
  };

  return mockArticle;
}

export default async function ArticlePage({ params }: { params: { id: string } }) {
  const article = await getArticle(params.id);

  if (!article) {
    notFound();
  }

  return (
    <div className="min-h-screen bg-background">
      <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Article Header */}
        <header className="mb-8 space-y-4">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {article.title}
          </h1>
          
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <time dateTime={article.createdAt.toISOString()}>
              {new Date(article.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </time>
            <span>•</span>
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary transition-colors underline underline-offset-4"
            >
              View original
            </a>
          </div>
        </header>

        {/* Article Content */}
        <div className="prose prose-neutral dark:prose-invert max-w-none">
          {article.content.split("\n\n").map((paragraph, index) => (
            <p key={index} className="mb-4 text-lg leading-relaxed text-foreground/90">
              {paragraph}
            </p>
          ))}
        </div>
      </article>
    </div>
  );
}
