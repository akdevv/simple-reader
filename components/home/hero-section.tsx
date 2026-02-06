import { LuPlay } from "react-icons/lu";
import { ArticleLinkInput } from "./article-link-input";

export function HeroSection() {
  return (
    <>
      {/* Floating preview card — desktop (outside max-w container) */}
      <div className="animate-fade-in-up animation-delay-300 pointer-events-none absolute top-32 right-[max(2rem,calc(50%-40rem))] z-0 hidden w-96 xl:block">
        <div className="rotate-2 rounded-2xl border border-border/50 bg-card/50 p-8 shadow-2xl shadow-black/20 backdrop-blur-lg">
          {/* Title skeleton */}
          <div className="mb-1.5 h-3 w-24 rounded-full bg-primary/25" />
          <div className="mb-5 h-2.5 w-16 rounded-full bg-primary/15" />
          {/* Body lines */}
          <div className="space-y-3">
            <div className="h-2.5 w-full rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-[90%] rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-4/5 rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-full rounded-full bg-muted-foreground/12" />
            <div className="flex items-center gap-1.5">
              <div className="h-2.5 w-3/4 rounded-full bg-primary/20" />
              <div className="size-1.5 rounded-full bg-primary/40 animate-pulse" />
            </div>
            <div className="h-2.5 w-[85%] rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-2/3 rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-[95%] rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-3/5 rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-4/5 rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-full rounded-full bg-muted-foreground/12" />
            <div className="h-2.5 w-2/3 rounded-full bg-muted-foreground/12" />
          </div>
          {/* Audio bar */}
          <div className="mt-6 flex items-center gap-3 rounded-xl bg-muted/30 px-4 py-2.5">
            <LuPlay className="size-4 fill-primary/50 text-primary/50" />
            <div className="h-2 flex-1 rounded-full bg-muted-foreground/10">
              <div className="h-2 w-2/5 rounded-full bg-primary/35" />
            </div>
            <span className="font-mono text-[11px] text-muted-foreground/40">
              2:34
            </span>
          </div>
        </div>
      </div>

      <section className="relative mx-auto max-w-6xl px-6 pt-20 pb-28 sm:px-10 sm:pt-32 sm:pb-40">
        {/* Mobile preview card — sits behind hero text */}
        <div
          className="pointer-events-none absolute top-6 -right-2 z-0 w-56 opacity-[0.08] sm:hidden"
          aria-hidden="true"
        >
          <div className="rotate-6 rounded-2xl border border-foreground/20 p-4">
            <div className="mb-3 h-2 w-12 rounded-full bg-foreground/30" />
            <div className="space-y-2">
              <div className="h-1.5 w-full rounded-full bg-foreground/20" />
              <div className="h-1.5 w-5/6 rounded-full bg-foreground/20" />
              <div className="h-1.5 w-4/5 rounded-full bg-foreground/20" />
              <div className="h-1.5 w-full rounded-full bg-foreground/20" />
              <div className="h-1.5 w-3/4 rounded-full bg-foreground/25" />
              <div className="h-1.5 w-5/6 rounded-full bg-foreground/20" />
              <div className="h-1.5 w-2/3 rounded-full bg-foreground/20" />
              <div className="h-1.5 w-full rounded-full bg-foreground/20" />
              <div className="h-1.5 w-4/6 rounded-full bg-foreground/20" />
            </div>
            <div className="mt-3 flex items-center gap-1.5">
              <div className="size-2.5 rounded-full bg-foreground/20" />
              <div className="h-1 flex-1 rounded-full bg-foreground/15">
                <div className="h-1 w-2/5 rounded-full bg-foreground/25" />
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-10 max-w-2xl">
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

          <div className="animate-fade-in-up animation-delay-200 mt-10">
            <ArticleLinkInput />
          </div>
          <p className="animate-fade-in animation-delay-300 mt-3.5 text-xs text-muted-foreground/60">
            Works with blogs, news sites, essays, newsletters, and more.
          </p>
        </div>
      </section>
    </>
  );
}
