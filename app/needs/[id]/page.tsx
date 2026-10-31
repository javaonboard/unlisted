import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { getNeedAnchor } from "@/lib/anchors/queries";
import { BackLink } from "@/components/anchors/BackLink";
import { Highlights } from "@/components/anchors/Highlights";
import { NegotiationList } from "@/components/anchors/NegotiationList";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { RangeForm } from "@/components/anchors/RangeForm";
import { setNeedRangeAction } from "@/app/actions/range";
import { rangeOfNeed } from "@/lib/places";

async function NeedAnchor({ params }: { params: Promise<{ id: string }> }) {
  const data = await getNeedAnchor((await params).id, await currentUserId());
  if (!data) notFound();
  const { need, negotiations } = data;

  return (
    <>
      <LiveRefresh active={negotiations.some((n) => n.room.status === "open")} />
      <BackLink href="/my-stuff" label="My stuff" />
      <Card>
        <CardHeader>
          <CardTitle>“{need.text}”</CardTitle>
          <CardDescription>
            {need.type === "request_service" ? "Service" : "To buy"} · {need.category}
            {need.maxPrice && ` · up to $${Number(need.maxPrice).toFixed(0)} (only you see this)`}
            {need.dueAt && ` · by ${need.dueAt.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}`}
          </CardDescription>
          <RangeForm action={setNeedRangeAction.bind(null, need.id)} miles={rangeOfNeed(need.maxMiles)} label="Anyone within" />
        </CardHeader>
      </Card>
      <h2 className="mt-6 mb-3 font-medium">Agents offering</h2>
      <Highlights entries={negotiations} buying={true} />
      <NegotiationList entries={negotiations} />
    </>
  );
}

export default function NeedPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <NeedAnchor params={params} />
      </Suspense>
    </main>
  );
}
