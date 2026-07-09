export function FeatureCard({
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
