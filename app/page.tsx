import {
  Headphones,
  Sparkles,
  ArrowRight,
  Bookmark,
  Eye,
  Volume2,
} from "lucide-react";
import { Button } from "@/components/ui/button";

function BookIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      className={className}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={16}
    >
      <path d="M108,144H40a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40" />
      <path d="M224,144H156a8,8,0,0,1-8-8V72a8,8,0,0,1,8-8h60a8,8,0,0,1,8,8v88a40,40,0,0,1-40,40" />
    </svg>
  );
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient gradient orbs */}
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -top-32 right-[10%] h-[500px] w-[500px] rounded-full bg-primary/8 blur-[140px]" />
        <div className="absolute top-[40%] -left-20 h-[350px] w-[350px] rounded-full bg-secondary/6 blur-[120px]" />
        <div className="absolute bottom-[10%] right-[20%] h-[300px] w-[300px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      {/* Subtle grain overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-1 opacity-[0.03]"
        aria-hidden="true"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />

      {/* Nav */}
      <header className="relative z-10 mx-auto flex max-w-5xl items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2.5">
          <BookIcon className="size-6 text-primary" />
          <span className="font-(family-name:--font-playfair) text-lg font-semibold italic tracking-tight text-foreground">
            simple reader
          </span>
        </div>
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          <a
            href="#features"
            className="transition-colors hover:text-foreground"
          >
            Features
          </a>
          <a href="#how" className="transition-colors hover:text-foreground">
            How it works
          </a>
        </nav>
      </header>

      {/* Hero */}
      <main className="relative z-10">
        <section className="mx-auto max-w-5xl px-6 pt-20 pb-28 sm:px-10 sm:pt-32 sm:pb-40">
          <div className="max-w-2xl">
            <div className="animate-fade-in flex items-center gap-2 text-sm font-semibold tracking-widest text-primary/80 uppercase">
              <span className="inline-block h-px w-6 bg-primary/40" />
              Read &middot; Listen &middot; Focus
            </div>
            <h1 className="animate-fade-in-up mt-6 text-4xl leading-[1.15] font-bold tracking-tight text-foreground sm:text-[3.25rem] sm:leading-[1.1]">
              Articles, distilled
              <br />
              to{" "}
              <span className="relative inline-block text-primary">
                what matters
                <span className="absolute -bottom-1 left-0 h-[3px] w-full rounded-full bg-primary/30" />
              </span>
              .
            </h1>
            <p className="animate-fade-in-up animation-delay-100 mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              Paste any link. Get a clean, readable view with synced
              text&#8209;to&#8209;speech. No ads, no clutter — just the words.
            </p>

            {/* URL input */}
            <div className="animate-fade-in-up animation-delay-200 mt-10 flex flex-col gap-3 sm:flex-row">
              <div className="group flex h-13 flex-1 items-center gap-3 rounded-xl border border-border bg-card/60 px-4 shadow-sm backdrop-blur-sm transition-all duration-300 focus-within:border-primary/40 focus-within:shadow-md focus-within:shadow-primary/5">
                <span className="select-none font-mono text-xs text-muted-foreground/50">
                  https://
                </span>
                <input
                  type="url"
                  placeholder="paste an article link…"
                  className="h-full flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40"
                  aria-label="Article URL"
                  disabled
                />
              </div>
              <Button
                size="lg"
                className="h-13 gap-2 rounded-xl px-7 text-sm font-semibold shadow-md shadow-primary/10 transition-shadow hover:shadow-lg hover:shadow-primary/20"
              >
                Read now
                <ArrowRight className="size-4" />
              </Button>
            </div>
            <p className="animate-fade-in animation-delay-300 mt-3.5 text-xs text-muted-foreground/60">
              Works with blogs, news sites, essays, newsletters, and more.
            </p>
          </div>

          {/* Floating preview card on desktop */}
          <div className="animate-fade-in-up animation-delay-300 pointer-events-none absolute top-36 right-10 hidden w-64 xl:block">
            <div className="rotate-2 rounded-2xl border border-border/40 bg-card/40 p-5 shadow-xl shadow-black/10 backdrop-blur-md">
              <div className="mb-3 h-2 w-16 rounded-full bg-primary/20" />
              <div className="space-y-2">
                <div className="h-2 w-full rounded-full bg-muted-foreground/10" />
                <div className="h-2 w-5/6 rounded-full bg-muted-foreground/10" />
                <div className="h-2 w-4/5 rounded-full bg-muted-foreground/10" />
                <div className="h-2 w-full rounded-full bg-muted-foreground/10" />
                <div className="h-2 w-3/4 rounded-full bg-primary/15" />
                <div className="h-2 w-5/6 rounded-full bg-muted-foreground/10" />
                <div className="h-2 w-2/3 rounded-full bg-muted-foreground/10" />
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground/40">
                <Volume2 className="size-3" />
                <div className="h-1 flex-1 rounded-full bg-muted-foreground/10">
                  <div className="h-1 w-2/5 rounded-full bg-primary/30" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section
          id="features"
          className="mx-auto max-w-5xl px-6 pb-28 sm:px-10 sm:pb-36"
        >
          <div className="mb-10 flex items-center gap-4">
            <h2 className="text-sm font-semibold tracking-widest text-muted-foreground/70 uppercase">
              Features
            </h2>
            <span className="h-px flex-1 bg-border/60" />
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <FeatureCard
              icon={<Eye className="size-5" />}
              title="Clean reading"
              description="Strips away ads, popups, and visual noise. Just the article in a beautiful, comfortable layout."
              accent="primary"
            />
            <FeatureCard
              icon={<Headphones className="size-5" />}
              title="Synced audio"
              description="Listen while you read. Words highlight in sync so you never lose your place."
              accent="secondary"
            />
            <FeatureCard
              icon={<Bookmark className="size-5" />}
              title="Save & resume"
              description="Bookmark articles for later. Pick up exactly where you left off, every time."
              accent="primary"
            />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="relative overflow-hidden border-t border-border/40">
          <div className="absolute inset-0 bg-linear-to-b from-muted/20 to-transparent" />
          <div className="relative mx-auto max-w-5xl px-6 py-28 sm:px-10 sm:py-36">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <Sparkles className="size-3 text-primary" />
                Simple by design
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Three steps. That&rsquo;s it.
              </h2>
            </div>
            <div className="mt-16 grid gap-8 sm:grid-cols-3 sm:gap-6">
              <Step
                number="01"
                title="Paste a link"
                description="Drop in any article URL — blogs, news, newsletters, essays."
              />
              <Step
                number="02"
                title="Read or listen"
                description="We extract the content and present it beautifully. Hit play to listen along."
              />
              <Step
                number="03"
                title="Save for later"
                description="Bookmark articles and pick up right where you left off."
              />
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6 sm:px-10">
          <div className="flex items-center gap-2">
            <BookIcon className="size-4 text-muted-foreground/60" />
            <span className="font-(family-name:--font-playfair) text-sm italic text-muted-foreground/60">
              simple reader
            </span>
          </div>
          <p className="text-xs text-muted-foreground/40">
            A personal reading tool.
          </p>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  accent: "primary" | "secondary";
}) {
  const accentClasses =
    accent === "primary"
      ? "bg-primary/10 text-primary group-hover:bg-primary/15"
      : "bg-secondary/10 text-secondary group-hover:bg-secondary/15";

  const borderHover =
    accent === "primary"
      ? "hover:border-primary/25"
      : "hover:border-secondary/25";

  return (
    <div
      className={`group relative rounded-2xl border border-border/50 bg-card/50 p-6 backdrop-blur-sm transition-all duration-300 hover:shadow-lg hover:shadow-black/5 ${borderHover}`}
    >
      <div
        className={`mb-4 flex size-10 items-center justify-center rounded-xl transition-colors duration-300 ${accentClasses}`}
      >
        {icon}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}

function Step({
  number,
  title,
  description,
}: {
  number: string;
  title: string;
  description: string;
}) {
  return (
    <div className="group flex flex-col items-center text-center sm:items-start sm:text-left">
      <span className="font-mono text-3xl font-bold tracking-tighter text-primary/20 transition-colors group-hover:text-primary/40">
        {number}
      </span>
      <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
    </div>
  );
}
