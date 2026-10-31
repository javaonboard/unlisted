import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { currentUserId } from "@/lib/session";
import { listFacts } from "@/lib/memory/queries";
import { BackLink } from "@/components/anchors/BackLink";
import { confirmFactAction, deleteFactAction, editFactAction } from "@/app/actions/memory";
import { setAddressAction } from "@/app/actions/profile";
import { getUser } from "@/lib/users/queries";

async function Facts() {
  const facts = await listFacts(await currentUserId());
  if (!facts.length) return <p className="text-sm text-muted-foreground">Nothing yet. Your agent learns after each deal.</p>;

  return (
    <div className="flex flex-col gap-2">
      {facts.map((f) => (
        <div key={f.id} className="rounded-2xl border p-3 text-sm">
          <form action={editFactAction.bind(null, f.id)} className="flex gap-2">
            <input name="fact" defaultValue={f.fact} className="h-8 flex-1 rounded-full border bg-background px-3" />
            <Button size="sm" variant="outline" type="submit">Save</Button>
          </form>
          <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
            <span>{f.verified ? "confirmed by you" : `guess · ${Math.round(f.confidence * 100)}% sure`}</span>
            <span>from {f.source}</span>
            <span className="ml-auto flex gap-2">
              {!f.verified && <form action={confirmFactAction.bind(null, f.id)}><Button size="sm" variant="ghost" type="submit">That&apos;s right</Button></form>}
              <form action={deleteFactAction.bind(null, f.id)}><Button size="sm" variant="ghost" type="submit">Forget</Button></form>
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// The street address lives here, private. Agents only ever see the neighborhood.
async function Address() {
  const user = await getUser(await currentUserId());
  return (
    <form action={setAddressAction} className="mb-8 rounded-2xl border p-4 text-sm">
      <p className="font-medium">Your address</p>
      <p className="mt-1 text-muted-foreground">Private. Agents only see your neighborhood ({user?.area}). It&apos;s shown to the other person only after both of you accept and the payment is held.</p>
      <div className="mt-3 flex gap-2">
        <input name="address" defaultValue={user?.address ?? ""} placeholder="Street, unit, city" className="h-10 flex-1 rounded-full border bg-background px-4" />
        <Button type="submit" variant="outline">Save</Button>
      </div>
    </form>
  );
}

export default function MemoryPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <BackLink href="/" label="Inbox" />
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">What my agent knows</h1>
          <p className="mt-1 text-muted-foreground">Learned from your deals. Only your agent uses it, never anyone else&apos;s.</p>
        </div>
        <a href="/memory/export" className="shrink-0 rounded-full border px-3 py-1.5 text-sm hover:bg-muted">Export</a>
      </div>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Address />
        <Facts />
      </Suspense>
    </main>
  );
}
