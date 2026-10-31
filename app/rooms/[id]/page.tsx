import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { getRoomView } from "@/lib/anchors/queries";
import { BackLink } from "@/components/anchors/BackLink";
import { ChatMessage } from "@/components/deals/ChatMessage";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { RoomNextSteps } from "@/components/rooms/RoomNextSteps";
import { nextFor, pillClass, pillText, roleOf } from "@/lib/anchors/next";

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const viewerId = await currentUserId();
  const data = await getRoomView((await params).id, viewerId);
  if (!data) notFound();
  const { room, item, need, names, messages, childSummaries } = data;

  const first = (id: string) => names[id]?.split(" ")[0] ?? id;
  const isSeller = room.sellerId === viewerId;
  const other = first(isSeller ? room.buyerId : room.sellerId);
  const back = isSeller ? { href: `/vault/${item.id}`, label: item.title } : room.buyerId === viewerId ? { href: `/needs/${need.id}`, label: need.text } : { href: "/vault", label: "My stuff" };

  return (
    <>
      <LiveRefresh active={room.status === "open" || childSummaries.some((c) => c.room.status === "open")} />
      <BackLink {...back} />
      <h1 className="mb-1 text-xl font-semibold">{other}&apos;s agent</h1>
      <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border px-2 py-0.5">{roleOf(data, viewerId).badge}</span>
        <span className={`rounded-full px-2 py-0.5 ${pillClass(nextFor(data, viewerId))}`}>{pillText(nextFor(data, viewerId))}</span>
        <span className="text-sm text-muted-foreground">{roleOf(data, viewerId).title}</span>
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border p-2">
        {messages.length === 0 && <p className="p-2 text-sm text-muted-foreground">Agents are getting ready…</p>}
        {messages.map((m) => (
          <ChatMessage key={m.id} m={m} viewerId={viewerId} name={first(m.fromUserId)} thread="" waiting={room.status === "waiting_owner"} />
        ))}
        {room.status === "agreed" && (
          <p className="m-2 rounded-xl bg-accent px-3 py-2 text-sm font-medium">✅ Deal agreed at ${Number(room.agreedPrice).toFixed(0)} · moved to next step</p>
        )}
        {room.status === "closed" && (
          <p className="m-2 rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">Closed: {room.closedReason}</p>
        )}
      </div>

      {room.status === "agreed" && <RoomNextSteps data={data} viewerId={viewerId} />}

      {childSummaries.length > 0 && (
        <div className="mt-3 rounded-2xl border p-4 text-sm">
          <p className="mb-2 font-medium">Your agent also talked to movers for this</p>
          {childSummaries.map((c) => (
            <Link key={c.room.id} href={`/rooms/${c.room.id}`} className="flex justify-between rounded-lg px-2 py-1.5 hover:bg-muted">
              <span>{first(c.room.sellerId)}</span>
              <span className={c.room.status === "agreed" ? "font-medium" : "text-muted-foreground"}>
                {c.room.status === "agreed" ? `✓ picked · $${Number(c.room.agreedPrice).toFixed(0)}${c.when ? `, ${c.when}` : ""}` : c.room.status === "open" ? `… talking${c.lastPrice ? `, $${Number(c.lastPrice).toFixed(0)}` : ""}` : `✗ ${c.room.closedReason}`} ▸
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Room params={params} />
      </Suspense>
    </main>
  );
}
