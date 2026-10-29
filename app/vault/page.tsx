import { Suspense } from "react";
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
        <Card key={item.id}>
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
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <VaultList />
      </Suspense>
    </main>
  );
}
