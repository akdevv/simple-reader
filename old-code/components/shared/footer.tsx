import { PiQuotes } from "react-icons/pi";

export function Footer() {
  return (
    <footer className="relative z-10 border-t border-border/40">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <div className="flex items-center gap-2">
          <PiQuotes className="size-4 text-muted-foreground/60" />
          <span className="font-(family-name:--font-playfair) text-sm italic text-muted-foreground/60">
            simple reader
          </span>
        </div>
        <p className="text-xs text-muted-foreground/40">
          made by{" "}
          <a
            href="https://github.com/akdevv"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground/60 decoration-primary underline-offset-3 transition-all hover:text-primary hover:underline"
          >
            @akdevv
          </a>
        </p>
      </div>
    </footer>
  );
}
