# Simple Reader — Website

Landing page for Simple Reader: a reader that turns any article into a clean
page you can read or listen to, with sentence-synced text-to-speech.

Built with [Astro](https://astro.build) and Tailwind CSS v4. Fully static,
dark-mode only, set in Newsreader.

## Development

```sh
pnpm install
pnpm dev      # http://localhost:4321
pnpm build    # static build in dist/
```

## Structure

```
src/
├── components/   # Navbar, HeroSection, FeatureCard, StepCard, Faq, Footer
├── layouts/      # Base layout (fonts, meta)
├── pages/        # index.astro
└── styles/       # global.css (theme tokens, animations)
```
