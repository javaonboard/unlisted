import Link from "next/link";

export function Breadcrumb({ trail }: { trail: { label: string; href?: string }[] }) {
  return (
    <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
      {trail.map((step, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <span>▸</span>}
          {step.href ? <Link href={step.href} className="hover:text-foreground hover:underline">{step.label}</Link> : <span className="text-foreground">{step.label}</span>}
        </span>
      ))}
    </nav>
  );
}
