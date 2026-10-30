import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { currentUserId } from "@/lib/session";
import { getRoomView } from "@/lib/anchors/queries";
import { Breadcrumb } from "@/components/anchors/Breadcrumb";
import { ChatMessage } from "@/components/deals/ChatMessage";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const viewerId = await currentUserId();
  const data = await getRoomView((await params).id, viewerId);
  if (!data) notFound();
  const { room, deal, item, need, names, messages, parents, children } = data;

  const isSeller = room.sellerId === viewerId;
  const isBuyer = room.buyerId === viewerId;
  const other = names[isSeller ? room.buyerId : room.sellerId]?.split(" ")[0];
  const trail = isSeller
    ? [{ label: "My things", href: "/vault" }, { label: item.title, href: `/vault/${item.id}` }, { label: `${other}'s agent` }]
    : isBuyer
      ? [{ label: "My needs", href: "/vault" }, { label: need.text, href: `/needs/${need.id}` }, { label: `${other}'s agent` }]
      : [{ label: "My plans" }, { label: deal?.title ?? "Plan", href: deal ? `/deals/${deal.id}` : undefined }, { label: room.label ?? "Negotiation" }];

  return (
    <>
      <LiveRefresh active={room.status === "open"} />
      <Breadcrumb trail={trail} />

      <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        <Badge variant={room.status === "agreed" ? "default" : "secondary"}>
          {room.status === "agreed" ? `Agreed $${Number(room.agreedPrice).toFixed(0)}` : room.status === "waiting_owner" ? "Waiting for an owner" : room.status === "open" ? `Talking · round ${room.round}` : `Closed: ${room.closedReason}`}
        </Badge>
        {deal && <Link href={`/deals/${deal.id}`} className="rounded-full border px-3 py-0.5 hover:bg-muted">Part of plan: {deal.title}</Link>}
        {parents.map((p) => <Link key={p.id} href={`/rooms/${p.id}`} className="rounded-full border px-3 py-0.5 hover:bg-muted">Serves: {p.label} ▸</Link>)}
        {children.map((c) => <Link key={c.id} href={`/rooms/${c.id}`} className="rounded-full border px-3 py-0.5 hover:bg-muted">Depends on this: {c.label} ▸</Link>)}
      </div>

      <div className="flex flex-col gap-1 rounded-2xl border p-2">
        {messages.length === 0 && <p className="p-2 text-sm text-muted-foreground">Agents are getting ready…</p>}
        {messages.map((m) => (
          <ChatMessage
            key={m.id}
            m={m}
            viewerId={viewerId}
            name={names[m.fromUserId]?.split(" ")[0] ?? m.fromUserId}
            thread=""
            waiting={room.status === "waiting_owner"}
          />
        ))}
      </div>
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
