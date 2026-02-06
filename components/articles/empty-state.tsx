import Link from "next/link";
import { LuBookOpen, LuArrowRight } from "react-icons/lu";
import { Button } from "@/components/ui/button";

export function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-6 flex size-16 items-center justify-center rounded-2xl border border-border/50 bg-card/50">
        <LuBookOpen className="size-7 text-muted-foreground/50" />
      </div>
      <h3 className="mb-2 text-lg font-semibold text-foreground">
        No articles yet
      </h3>
      <p className="mb-6 max-w-sm text-sm text-muted-foreground/60">
        Paste a link or some text on the home page to save your first article.
      </p>
      <Button asChild variant="outline" className="gap-2">
        <Link href="/">
          Add your first article
          <LuArrowRight className="size-4" />
        </Link>
      </Button>
    </div>
  );
}
