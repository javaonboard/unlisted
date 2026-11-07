import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { getItemView } from "@/lib/views/queries";
import { BackLink } from "@/components/shared/BackLink";
import { Talks } from "@/components/shared/Talks";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { RangeForm } from "@/components/shared/RangeForm";
import { setItemRangeAction } from "@/app/actions/range";
import { rangeOfOffer } from "@/lib/places";
import { PriceAdvice } from "@/components/shared/PriceAdvice";
import { EditItem } from "@/components/shared/EditForms";
import { ItemPhotos } from "@/components/items/ItemPhotos";
import { checkItemPriceAction, removeItemAction, setWaysAction, updateItemAction, useItemPriceAction } from "@/app/actions/edit";
import { ConfirmAction } from "@/components/ConfirmAction";
import { WaysSwitch } from "@/components/items/WaysSwitch";
import { waysOf } from "@/lib/items/ways";

const isFresh = (at: Date) => Date.now() - at.getTime() < 3 * 60_000;

async function ItemView({ params }: { params: Promise<{ id: string }> }) {
  const data = await getItemView((await params).id, await currentUserId());
  if (!data) notFound();
  const { item, evidence, negotiations } = data;
  const notes = evidence.filter((e) => !e.summary.startsWith("Photo check:")); // the photo check shows with the photos
  // Just added: the agent's first look (photo check, price check) may still be running.
  const fresh = isFresh(item.createdAt);
  const checking = !item.removedAt && fresh && ((item.photos.length > 0 && !item.inspection) || !item.priceCheck);

  return (
    <>
      <LiveRefresh active={checking || negotiations.some((n) => n.room.status === "open")} every={checking ? 3000 : 2000} />
      <BackLink href="/my-stuff" label="My stuff" />
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {item.title}
            {item.removedAt ? <Badge variant="secondary">Removed</Badge> : <Badge variant={item.openToOffers ? "default" : "secondary"}>{item.openToOffers ? "Open to offers" : "Private"}</Badge>}
          </CardTitle>
          <CardDescription>{item.condition ?? item.category}</CardDescription>
          {checking && (
            <div className="mt-2 rounded-xl bg-accent px-3 py-2 text-sm">
              <p>Your agent is doing a quick check: {[item.photos.length > 0 && !item.inspection ? "the photo" : null, !item.priceCheck ? "the price" : null].filter(Boolean).join(" and ")}…</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-primary/20"><div className="h-full w-1/3 animate-pulse rounded-full bg-primary" /></div>
            </div>
          )}
          <ItemPhotos itemId={item.id} photos={item.photos} inspection={item.inspection ?? null} kind={item.kind} />
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p>{item.kind === "skill" ? "Price per job" : "Asking price"}: ${Number(item.estimatedValue ?? 0).toFixed(0)}{item.rentPerDay ? ` · rent $${Number(item.rentPerDay).toFixed(0)}/day, $${Number(item.deposit ?? 0).toFixed(0)} deposit` : ""}</p>
            {/* Sell, rent out or both. Hidden while a deal on it is agreed, so the deal stays as agreed. */}
            {item.kind === "goods" && !item.soldAt && !item.removedAt && !negotiations.some((n) => n.room.status === "agreed") && (
              <div className="my-2"><WaysSwitch ways={waysOf(item)} onChange={setWaysAction.bind(null, item.id)} /></div>
            )}
            {item.minPrice && <p>Your minimum: ${Number(item.minPrice).toFixed(0)} <span className="text-muted-foreground">(only you see this)</span></p>}
            {!item.removedAt && <RangeForm action={setItemRangeAction.bind(null, item.id)} miles={rangeOfOffer(item.maxMiles)} label={item.kind === "skill" ? "I travel up to" : "I'll deliver up to"} pickup={item.kind === "goods"} />}
            {Object.keys(item.details).length > 0 && <p className="text-muted-foreground">{Object.entries(item.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}</p>}
          </div>
          <div>
            <p className="font-medium">Evidence</p>
            {notes.length === 0 && <p className="text-muted-foreground">None yet.</p>}
            {notes.map((e) => (
              <p key={e.id} className="text-muted-foreground">{e.summary} <span className="text-xs">({e.verified ? "verified" : "their claim"})</span></p>
            ))}
          </div>
        </CardContent>
        {!item.removedAt && !item.soldAt && (
          <div className="px-4">
            <PriceAdvice check={item.priceCheck ?? null} onCheck={checkItemPriceAction.bind(null, item.id)} onUse={useItemPriceAction.bind(null, item.id)} useLabel="Ask" />
            <EditItem action={updateItemAction.bind(null, item.id)} item={item} />
            <div className="mt-3 flex justify-end">
              <ConfirmAction
                label="Remove"
                variant="link"
                size="xs"
                title={`Remove ${item.title}?`}
                points={["Agents won't see it or suggest it any more.", "Talks about it end, and the other side is told.", "Old chats and receipts stay."]}
                confirm="Remove"
                action={removeItemAction.bind(null, item.id)}
                done="Removed."
                goTo="/my-stuff"
              />
            </div>
          </div>
        )}
      </Card>

      <Talks entries={negotiations} buying={false} />
    </>
  );
}

export default function ItemPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <ItemView params={params} />
      </Suspense>
    </main>
  );
}
