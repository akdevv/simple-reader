import {
  LuHeadphones,
  LuSparkles,
  LuBookmark,
  LuEye,
  LuLink2,
  LuPlay,
  LuBookMarked,
} from "react-icons/lu";
import { Navbar } from "@/components/shared/navbar";
import { Footer } from "@/components/shared/footer";
import { HeroSection } from "@/components/home/hero-section";
import { FeatureCard } from "@/components/home/feature-card";
import { StepCard } from "@/components/home/steps-card";

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

      <Navbar />

      <main className="relative z-10">
        <HeroSection />

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
              icon={<LuEye className="size-5" />}
              title="Clean reading"
              description="Strips away ads, popups, and visual noise. Just the article in a beautiful, comfortable layout."
              accent="primary"
            />
            <FeatureCard
              icon={<LuHeadphones className="size-5" />}
              title="Synced audio"
              description="Listen while you read. Words highlight in sync so you never lose your place."
              accent="secondary"
            />
            <FeatureCard
              icon={<LuBookmark className="size-5" />}
              title="Save & resume"
              description="Bookmark articles for later. Pick up exactly where you left off, every time."
              accent="primary"
            />
          </div>
        </section>

        {/* How it works */}
        <section
          id="how"
          className="relative overflow-hidden border-t border-border/40"
        >
          <div className="absolute inset-0 bg-linear-to-b from-muted/20 to-transparent" />
          <div className="relative mx-auto max-w-5xl px-6 py-28 sm:px-10 sm:py-36">
            <div className="flex flex-col items-center text-center">
              <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur-sm">
                <LuSparkles className="size-3 text-primary" />
                Simple by design
              </span>
              <h2 className="mt-5 text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
                Three steps. That&rsquo;s it.
              </h2>
            </div>
            <div className="mt-16 grid gap-6 sm:grid-cols-3 sm:gap-5">
              <StepCard
                number="01"
                title="Paste a link or your content"
                description="Drop in any article URL, or paste the text directly — we'll make it readable either way."
                icon={<LuLink2 className="size-4" />}
              />
              <StepCard
                number="02"
                title="Read or listen"
                description="We extract the content and present it beautifully. Hit play to listen along."
                icon={<LuPlay className="size-4" />}
              />
              <StepCard
                number="03"
                title="Save for later"
                description="Bookmark articles and pick up right where you left off."
                icon={<LuBookMarked className="size-4" />}
              />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
