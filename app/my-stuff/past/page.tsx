import { Suspense } from "react";
import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { pastFor } from "@/lib/items/past";
import { money } from "@/lib/payments/fees";
import { BackLink } from "@/components/shared/BackLink";

const when = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

// Things that changed hands: sold, bought, hired or rented. Each links to its receipt.
async function Past() {
  const rows = await pastFor(await currentUserId());
  if (!rows.length) return <p className="text-sm text-muted-foreground">Nothing yet. Things you sell or buy show up here after the handoff.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {rows.map((r) => (
        <li key={r.legId}>
          <Link href={`/money/${r.legId}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 hover:bg-muted/40">
            <span><span className="font-medium">{r.what}</span><span className="block text-muted-foreground">{r.line} · {when(r.at)}</span></span>
            <span className="shrink-0 text-right">{money(r.amount)}<span className="block text-xs text-muted-foreground">{r.refunded ? "refunded" : "receipt"}</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function PastPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <BackLink href="/my-stuff" label="My stuff" />
      <h1 className="mb-1 text-2xl font-semibold">Things I had</h1>
      <p className="mb-4 text-muted-foreground">What you sold, bought, hired or rented, once it changed hands.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Past />
      </Suspense>
    </main>
  );
}
