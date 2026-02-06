"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { PiQuotes } from "react-icons/pi";

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Lock body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const navLinks = [
    { href: "/articles", label: "Articles" },
    { href: "/#features", label: "Features" },
    { href: "/#how", label: "How it works" },
  ];

  return (
    <>
      <header className="relative z-50 mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" className="flex items-center gap-2.5">
          <PiQuotes className="size-6 text-primary" />
          <span className="font-(family-name:--font-playfair) text-lg font-semibold italic tracking-tight text-foreground">
            simple reader
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-8 text-sm font-medium text-muted-foreground sm:flex">
          {navLinks.map((link) =>
            link.href.startsWith("/#") ? (
              <a
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            )
          )}
        </nav>

        {/* Mobile hamburger button */}
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative z-50 flex size-10 items-center justify-center sm:hidden"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          aria-expanded={isOpen}
        >
          <div className="flex w-5 flex-col items-end gap-[5px]">
            <span
              className={`block h-[1.5px] rounded-full bg-foreground transition-all duration-300 ease-out ${
                isOpen
                  ? "w-5 translate-y-[6.5px] rotate-45"
                  : "w-5"
              }`}
            />
            <span
              className={`block h-[1.5px] rounded-full bg-foreground transition-all duration-300 ease-out ${
                isOpen ? "w-0 opacity-0" : "w-3.5"
              }`}
            />
            <span
              className={`block h-[1.5px] rounded-full bg-foreground transition-all duration-300 ease-out ${
                isOpen
                  ? "w-5 -translate-y-[6.5px] -rotate-45"
                  : "w-5"
              }`}
            />
          </div>
        </button>
      </header>

      {/* Mobile fullscreen overlay */}
      <div
        className={`fixed inset-0 z-40 flex flex-col bg-background transition-all duration-500 ease-out sm:hidden ${
          isOpen
            ? "visible opacity-100"
            : "invisible opacity-0"
        }`}
      >
        {/* Ambient glow — matches landing page feel */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div
            className={`absolute top-[15%] right-[5%] h-[300px] w-[300px] rounded-full bg-primary/6 blur-[120px] transition-all duration-700 ${
              isOpen ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          />
          <div
            className={`absolute bottom-[20%] left-[10%] h-[250px] w-[250px] rounded-full bg-secondary/5 blur-[100px] transition-all duration-700 delay-100 ${
              isOpen ? "scale-100 opacity-100" : "scale-75 opacity-0"
            }`}
          />
        </div>

        {/* Nav content — centered vertically */}
        <nav className="relative flex flex-1 flex-col items-start justify-center px-10">
          <div className="mb-8">
            <span className="text-[11px] font-medium tracking-[0.2em] uppercase text-muted-foreground/50">
              Navigation
            </span>
            <div className="mt-2 h-px w-8 bg-primary/40" />
          </div>

          <ul className="flex flex-col gap-1">
            {navLinks.map((link, i) => {
              const isActive =
                pathname === link.href ||
                (link.href === "/articles" && pathname.startsWith("/articles"));

              return (
                <li key={link.href}>
                  {link.href.startsWith("/#") ? (
                    <a
                      href={link.href}
                      onClick={() => setIsOpen(false)}
                      className={`group flex items-center gap-4 py-3 transition-all duration-300 ${
                        isOpen
                          ? "translate-x-0 opacity-100"
                          : "-translate-x-6 opacity-0"
                      }`}
                      style={{
                        transitionDelay: isOpen ? `${150 + i * 75}ms` : "0ms",
                      }}
                    >
                      <span className="text-[11px] font-mono text-muted-foreground/30 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-[28px] font-light tracking-tight transition-colors ${
                          isActive
                            ? "text-primary"
                            : "text-foreground/80 group-hover:text-foreground"
                        }`}
                      >
                        {link.label}
                      </span>
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className={`group flex items-center gap-4 py-3 transition-all duration-300 ${
                        isOpen
                          ? "translate-x-0 opacity-100"
                          : "-translate-x-6 opacity-0"
                      }`}
                      style={{
                        transitionDelay: isOpen ? `${150 + i * 75}ms` : "0ms",
                      }}
                    >
                      <span className="text-[11px] font-mono text-muted-foreground/30 tabular-nums">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-[28px] font-light tracking-tight transition-colors ${
                          isActive
                            ? "text-primary"
                            : "text-foreground/80 group-hover:text-foreground"
                        }`}
                      >
                        {link.label}
                      </span>
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Bottom branding */}
        <div
          className={`relative px-10 pb-10 transition-all duration-500 ${
            isOpen
              ? "translate-y-0 opacity-100"
              : "translate-y-4 opacity-0"
          }`}
          style={{ transitionDelay: isOpen ? "400ms" : "0ms" }}
        >
          <div className="h-px w-full bg-border/30" />
          <div className="mt-5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PiQuotes className="size-3.5 text-muted-foreground/40" />
              <span className="font-(family-name:--font-playfair) text-xs italic text-muted-foreground/40">
                simple reader
              </span>
            </div>
            <span className="text-[10px] tracking-wider text-muted-foreground/25 uppercase">
              Distraction-free reading
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
