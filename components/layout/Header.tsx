import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { listPersonas } from "@/lib/users/queries";
import { needsYou } from "@/lib/inbox/needs";
import { PersonaSwitcher } from "./PersonaSwitcher";
import { ConfirmAction } from "@/components/ConfirmAction";
import { resetDemoAction } from "@/app/actions/demo";

const links = [
  { href: "/", label: "Inbox" },
  { href: "/my-stuff", label: "My stuff" },
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
      {/* The demo has no login: anyone can switch people to try both sides of a deal. */}
      <div className="flex flex-col items-end gap-0.5">
        <PersonaSwitcher personas={personas} current={current} />
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          Shared demo: no login, switch people to try both sides ·
          <ConfirmAction
            variant="link"
            size="xs"
            label="Reset demo"
            title="Reset the demo?"
            points={["Everything goes back to the start: people, things, deals and chats.", "Changes anyone made are cleared, for everyone using the demo.", "PayPal sandbox payments already made stay in PayPal."]}
            confirm="Reset"
            action={resetDemoAction}
          />
        </span>
      </div>
    </header>
  );
}
