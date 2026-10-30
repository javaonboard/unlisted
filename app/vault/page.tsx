import { Suspense } from "react";
import Link from "next/link";
import { and, asc, eq, inArray, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { currentUserId } from "@/lib/session";
import { findDemandFor } from "@/lib/matching/matcher";
import { iconFor, statusLine } from "@/lib/anchors/status";
import { planMovingDay } from "@/app/actions/deals";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { PhotoToVault } from "@/components/vault/PhotoToVault";

async function Vault() {
  const userId = await currentUserId();
  const [items, needs, users, plans] = await Promise.all([
    db.select().from(schema.vaultItems).where(eq(schema.vaultItems.ownerId, userId)).orderBy(asc(schema.vaultItems.createdAt)),
    db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open"))),
    db.select().from(schema.users),
    db.select().from(schema.deals).where(eq(schema.deals.ownerId, userId)),
  ]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const ids = [...items.map((i) => i.id), ...needs.map((n) => n.id)];
  const rooms = ids.length
    ? await db.select().from(schema.negotiations).where(or(inArray(schema.negotiations.itemId, ids), inArray(schema.negotiations.intentId, ids)))
    : [];
  const interested = Object.fromEntries(await Promise.all(items.map(async (i) => [i.id, (await findDemandFor(i.id)).length] as const)));
  const canPlan = needs.some((n) => n.type === "sell") && needs.some((n) => n.type === "buy") && plans.length === 0;

  return (
    <>
      <LiveRefresh active={rooms.some((r) => r.status === "open") || (plans.length > 0 && !rooms.some((r) => r.dependsOn.length > 0))} />
      {canPlan && (
        <form action={planMovingDay} className="mb-6 flex items-center justify-between rounded-2xl bg-accent p-4">
          <p className="text-sm">Your needs fit together: sell, buy and a mover, all for Saturday.</p>
          <Button type="submit">Plan my moving day</Button>
        </form>
      )}
      {plans.map((p) => (
        <Link key={p.id} href={`/deals/${p.id}`} className="mb-6 block rounded-2xl bg-accent p-4 text-sm hover:bg-accent/70">
          📋 Plan: <span className="font-medium">{p.title}</span> · see every part, the total and Saturday&apos;s timeline ▸
          {p.scoutNote && <span className="mt-2 block text-muted-foreground">🧭 {p.scoutNote}</span>}
        </Link>
      ))}

      <PhotoToVault />

      <h2 className="mb-3 font-medium">My things</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <Link key={item.id} href={`/vault/${item.id}`} className="flex gap-3 rounded-2xl border p-3 hover:bg-muted/40">
            {item.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.photos[0]} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-secondary text-2xl">{iconFor(item.category)}</div>
            )}
            <div className="min-w-0">
              <p className="font-medium">{item.title}</p>
              <p className="truncate text-sm text-muted-foreground">{item.condition ?? item.category} · ~${Number(item.estimatedValue ?? 0).toFixed(0)}</p>
              <p className="mt-1 text-sm">{statusLine(rooms.filter((r) => r.itemId === item.id), names, userId, interested[item.id])} ▸</p>
            </div>
          </Link>
        ))}
      </div>

      <h2 className="mt-8 mb-3 font-medium">My needs</h2>
      <div className="flex flex-col gap-2">
        {needs.filter((n) => n.type !== "sell").map((need) => (
          <Link key={need.id} href={`/needs/${need.id}`} className="flex items-center justify-between rounded-2xl border p-3 text-sm hover:bg-muted/40">
            <span>{iconFor(need.category)} “{need.text}”</span>
            <span>{statusLine(rooms.filter((r) => r.intentId === need.id), names, userId)} ▸</span>
          </Link>
        ))}
        {needs.filter((n) => n.type !== "sell").length === 0 && <p className="text-sm text-muted-foreground">No open needs.</p>}
      </div>
    </>
  );
}

export default function VaultPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Vault</h1>
      <p className="mt-1 mb-6 text-muted-foreground">What you own, what you can do, and what you need. Private until you say yes.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Vault />
      </Suspense>
    </main>
  );
}
