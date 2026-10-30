import { Suspense } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { discoverFor } from "@/lib/matching/discover";
import { listRooms } from "@/lib/negotiation/queries";
import { startNegotiation } from "@/app/actions/rooms";
import { planMovingDay } from "@/app/actions/deals";
import { listDealsFor } from "@/lib/deals/queries";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

async function Discover() {
  const userId = await currentUserId();
  const { demand, supply } = await discoverFor(userId);

  if (!demand.length && !supply.length) return <p className="text-sm text-muted-foreground">No matches right now.</p>;

  return (
    <div className="flex flex-col gap-3">
      {demand.map(({ item, buyers }) => (
        <Card key={item.id}>
          <CardHeader>
            <CardTitle>
              {buyers.length === 1 ? "1 person wants" : `${buyers.length} people want`} your {item.title.toLowerCase()}
            </CardTitle>
            <CardDescription>
              Same category, price ranges overlap, size fits. {item.openToOffers ? "" : "Your item stays private until you start."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {buyers.map(({ intent, name }) => (
              <form
                key={intent.id}
                action={startNegotiation.bind(null, { buyerId: intent.ownerId, sellerId: userId, itemId: item.id, intentId: intent.id })}
              >
                <Button type="submit" variant="outline">Let my agent talk to {name}</Button>
              </form>
            ))}
          </CardContent>
        </Card>
      ))}
      {supply.map(({ intent, open, privateCount }) => (
        <Card key={intent.id}>
          <CardHeader>
            <CardTitle>Matches for “{intent.text}”</CardTitle>
            <CardDescription>
              {open.length} open {open.length === 1 ? "offer" : "offers"}
              {privateCount > 0 && ` · ${privateCount} private ${privateCount === 1 ? "match" : "matches"}, the owner has been asked`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {open.map(({ item, name }) => (
              <form
                key={item.id}
                action={startNegotiation.bind(null, { buyerId: userId, sellerId: item.ownerId, itemId: item.id, intentId: intent.id })}
              >
                <Button type="submit" variant="outline">{item.title} · {name}</Button>
              </form>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

async function Deals() {
  const userId = await currentUserId();
  const [deals, needs] = await Promise.all([
    listDealsFor(userId),
    db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open"))),
  ]);
  const canLink = needs.some((n) => n.type === "sell") && needs.some((n) => n.type === "buy");
  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {deals.map((d) => (
        <Link key={d.id} href={`/deals/${d.id}`} className="rounded-full border px-3 py-1 text-sm hover:bg-muted">
          # {d.title.toLowerCase().replace(/\s+/g, "-")}
        </Link>
      ))}
      {canLink && !deals.some((d) => d.ownerId === userId) && (
        <form action={planMovingDay}>
          <Button type="submit">Plan my moving day</Button>
        </form>
      )}
    </div>
  );
}

async function Rooms() {
  const rooms = await listRooms(await currentUserId());
  if (!rooms.length) return <p className="text-sm text-muted-foreground">No negotiations yet.</p>;

  return (
    <div className="flex flex-col gap-2">
      {rooms.map((r) => (
        <Link key={r.id} href={`/rooms/${r.id}`} className="flex items-center justify-between rounded-xl border p-3 hover:bg-muted/50">
          <span className="text-sm">
            <span className="font-medium">{r.item?.title}</span> · {r.buyer?.name} ↔ {r.seller?.name}
          </span>
          <Badge variant={r.status === "agreed" ? "default" : "secondary"}>
            {r.status === "agreed" ? `Agreed $${Number(r.agreedPrice).toFixed(0)}` : r.status}
          </Badge>
        </Link>
      ))}
    </div>
  );
}

export default function RoomsPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Agents</h1>
      <p className="mt-1 mb-6 text-muted-foreground">How your agent finds people and what it says to their agents.</p>

      <h2 className="mb-3 font-medium">Deals</h2>
      <Suspense fallback={null}>
        <Deals />
      </Suspense>

      <h2 className="mb-3 font-medium">Discover</h2>
      <Suspense fallback={<p className="text-muted-foreground">Finding matches…</p>}>
        <Discover />
      </Suspense>

      <h2 className="mt-8 mb-3 font-medium">Negotiations</h2>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Rooms />
      </Suspense>
    </main>
  );
}
