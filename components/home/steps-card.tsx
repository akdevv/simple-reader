export function StepCard({
  number,
  title,
  description,
  icon,
}: {
  number: string;
  title: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/8 bg-linear-to-br from-white/6 to-white/2 p-6 shadow-lg shadow-black/4 backdrop-blur-xl transition-colors duration-300 hover:border-primary/25 dark:from-white/4 dark:to-white/1">
      {/* Frosted glass shimmer on hover */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-primary/4 via-transparent to-secondary/3 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {/* Top edge highlight */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent" />
      {/* Step number watermark */}
      <span className="absolute top-3 right-4 font-mono text-5xl font-bold tracking-tighter text-primary/6 transition-colors duration-300 group-hover:text-primary/[0.14]">
        {number}
      </span>
      {/* Icon */}
      <div className="relative mb-4 flex size-10 items-center justify-center rounded-xl border border-primary/15 bg-primary/8 text-primary ring-1 ring-primary/5 transition-colors duration-300 group-hover:border-primary/30 group-hover:bg-primary/15">
        {icon}
      </div>
      <h3 className="relative text-base font-semibold tracking-tight text-foreground">
        {title}
      </h3>
      <p className="relative mt-2 text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {/* Bottom accent line */}
      <div className="pointer-events-none absolute bottom-0 left-4 right-4 h-px bg-linear-to-r from-transparent via-primary/25 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
    </div>
  );
}
