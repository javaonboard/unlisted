import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { listPersonas } from "@/lib/users/queries";
import { needsYou } from "@/lib/inbox/needs";
import { PersonaSwitcher } from "./PersonaSwitcher";

const links = [
  { href: "/", label: "Inbox" },
  { href: "/vault", label: "My stuff" },
  { href: "/schedule", label: "Schedule" },
  { href: "/connect", label: "Connect your AI" },
];

export async function Header() {
  const [personas, current] = await Promise.all([listPersonas(), currentUserId()]);
  const { count } = await needsYou(current);

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <nav className="flex items-center gap-6">
        <Link href="/" className="text-lg font-semibold">Unlisted</Link>
        {links.map((link) => (
          <Link key={link.href} href={link.href} className="text-sm text-muted-foreground hover:text-foreground">
            {link.label}
            {link.href === "/" && count > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-white">{count}</span>}
          </Link>
        ))}
      </nav>
      <PersonaSwitcher personas={personas} current={current} />
    </header>
  );
}
