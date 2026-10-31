import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { getItemAnchor } from "@/lib/anchors/queries";
import { BackLink } from "@/components/anchors/BackLink";
import { Highlights } from "@/components/anchors/Highlights";
import { NegotiationList } from "@/components/anchors/NegotiationList";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { RangeForm } from "@/components/anchors/RangeForm";
import { setItemRangeAction } from "@/app/actions/range";
import { rangeOfOffer } from "@/lib/places";

async function ItemAnchor({ params }: { params: Promise<{ id: string }> }) {
  const data = await getItemAnchor((await params).id, await currentUserId());
  if (!data) notFound();
  const { item, evidence, negotiations } = data;

  return (
    <>
      <LiveRefresh active={negotiations.some((n) => n.room.status === "open")} />
      <BackLink href="/my-stuff" label="My stuff" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {item.title}
            <Badge variant={item.openToOffers ? "default" : "secondary"}>{item.openToOffers ? "Open to offers" : "Private"}</Badge>
          </CardTitle>
          <CardDescription>{item.condition ?? item.category}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p>Estimated value: ${Number(item.estimatedValue ?? 0).toFixed(0)}</p>
            {item.minPrice && <p>Your minimum: ${Number(item.minPrice).toFixed(0)} <span className="text-muted-foreground">(only you see this)</span></p>}
            <RangeForm action={setItemRangeAction.bind(null, item.id)} miles={rangeOfOffer(item.maxMiles)} label={item.kind === "skill" ? "I travel up to" : "I'll deliver up to (0 = pickup only)"} />
            {Object.keys(item.details).length > 0 && <p className="text-muted-foreground">{Object.entries(item.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
          </div>
          <div>
            <p className="font-medium">Evidence</p>
            {evidence.length === 0 && <p className="text-muted-foreground">None yet.</p>}
            {evidence.map((e) => (
              <p key={e.id} className="text-muted-foreground">{e.summary} <span className="text-xs">({e.verified ? "verified" : "their claim"})</span></p>
            ))}
          </div>
        </CardContent>
      </Card>

      <h2 className="mt-6 mb-3 font-medium">Agents interested</h2>
      <Highlights entries={negotiations} buying={false} />
      <NegotiationList entries={negotiations} />
    </>
  );
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ItemAnchor params={params} />
      </Suspense>
    </main>
  );
}
