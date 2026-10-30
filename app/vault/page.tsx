import { Suspense } from "react";
import Link from "next/link";
import { and, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { listVault } from "@/lib/vault/queries";

async function VaultList() {
  const items = await listVault(await currentUserId());

  if (items.length === 0) return <p className="text-sm text-muted-foreground">Your vault is empty.</p>;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <Link key={item.id} href={`/vault/${item.id}`}>
        <Card className="h-full transition-colors hover:bg-muted/40">
          <CardHeader>
            <CardTitle>{item.title}</CardTitle>
            <CardDescription>{item.condition ?? item.category}</CardDescription>
          </CardHeader>
          <CardContent className="flex items-center justify-between text-sm">
            <span>{item.estimatedValue ? `~$${Number(item.estimatedValue).toFixed(0)}` : ""}</span>
            <div className="flex gap-2">
              <Badge variant="outline">{item.kind === "skill" ? "Skill" : "Item"}</Badge>
              <Badge variant={item.openToOffers ? "default" : "secondary"}>
                {item.openToOffers ? "Open to offers" : "Private"}
              </Badge>
            </div>
          </CardContent>
        </Card>
        </Link>
      ))}
    </div>
  );
}

async function NeedsList() {
  const userId = await currentUserId();
  const needs = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open")));
  if (needs.length === 0) return <p className="text-sm text-muted-foreground">No open needs.</p>;
  return (
    <div className="flex flex-col gap-2">
      {needs.map((n) => (
        <Link key={n.id} href={`/needs/${n.id}`} className="flex items-center justify-between rounded-xl border p-3 text-sm hover:bg-muted/50">
          <span>“{n.text}”</span>
          <Badge variant="outline">{n.type === "request_service" ? "Service" : n.type === "sell" ? "Sell" : "Buy"}</Badge>
        </Link>
      ))}
    </div>
  );
}

export default function VaultPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">Vault</h1>
      <p className="mt-1 mb-6 text-muted-foreground">
        What you own and what you can do. Private until you say yes to a real buyer.
      </p>
      <h2 className="mb-3 font-medium">My things</h2>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <VaultList />
      </Suspense>
      <h2 className="mt-8 mb-3 font-medium">My needs</h2>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <NeedsList />
      </Suspense>
    </main>
  );
}
