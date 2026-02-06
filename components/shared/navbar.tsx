import { PiQuotes } from "react-icons/pi";

export function Navbar() {
  return (
    <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
      <div className="flex items-center gap-2.5">
        <PiQuotes className="size-6 text-primary" />
        <span className="font-(family-name:--font-playfair) text-lg font-semibold italic tracking-tight text-foreground">
          simple reader
        </span>
      </div>
      <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
        <a href="#features" className="transition-colors hover:text-foreground">
          Features
        </a>
        <a href="#how" className="transition-colors hover:text-foreground">
          How it works
        </a>
      </nav>
    </header>
  );
}
