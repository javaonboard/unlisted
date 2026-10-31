import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Compass } from "lucide-react";
import { currentUserId } from "@/lib/session";
import { getPlan } from "@/lib/deals/queries";
import { BackLink } from "@/components/anchors/BackLink";
import { RoleBadge, StatusPill } from "@/components/anchors/Badges";
import { FormattedText } from "@/components/FormattedText";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";

const GROUPS = [
  { key: "sell", title: "Selling" },
  { key: "buy", title: "Buying" },
  { key: "helper", title: "Help to get it done" },
] as const;

// A plan at a glance. Each part is a normal deal with its own chat and steps.
async function Plan({ params }: { params: Promise<{ id: string }> }) {
  const data = await getPlan((await params).id, await currentUserId());
  if (!data) notFound();
  const { deal, parts, isOwner } = data;
  const talking = parts.some((p) => p.next.state === "talking");

  return (
    <>
      <LiveRefresh active={talking} every={4000} />
      <BackLink href="/" label="Inbox" />
      <h1 className="mb-1 text-2xl font-semibold">{deal.title}</h1>
      {isOwner && (
        <ul className="mb-4 list-disc space-y-0.5 pl-5 text-sm text-muted-foreground">
          {deal.saleWaitsForPurchase && <li>Your sale waits until your purchase is agreed.</li>}
          {deal.helperIds.length > 0 && <li>Help (a mover, an installer) is booked once the goods are agreed, around those handoffs.</li>}
          <li>Each part is its own deal: accept it, pay with PayPal, hand off.</li>
        </ul>
      )}
      {isOwner && deal.scoutNote && (
        <div className="mb-4 flex gap-2 rounded-xl bg-accent px-3 py-2 text-sm"><Compass className="mt-0.5 size-4 shrink-0 text-primary" /><FormattedText text={deal.scoutNote} /></div>
      )}

      {GROUPS.map(({ key, title }) => {
        const rows = parts.filter((p) => p.group === key);
        if (!rows.length) return null;
        return (
          <section key={key} className="mb-5">
            <h2 className="mb-2 font-medium">{title}</h2>
            <div className="flex flex-col gap-2">
              {rows.map((p) => (
                <Link key={p.room.id} href={`/rooms/${p.room.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm hover:bg-muted/40">
                  <span className="min-w-0">
                    <span className="font-medium">{p.room.label}</span>
                    <span className="text-muted-foreground">{p.room.agreedPrice ? ` · $${Number(p.room.agreedPrice).toFixed(0)}` : ""} · {p.distance}</span>
                    <span className="mt-1 flex flex-wrap gap-2"><RoleBadge role={p.role} /><StatusPill next={p.next} /></span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export default function PlanPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Plan params={params} />
      </Suspense>
    </main>
  );
}
