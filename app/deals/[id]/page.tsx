import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUserId } from "@/lib/session";
import { getDealChannel, listDealsFor } from "@/lib/deals/queries";
import { ChatMessage } from "@/components/deals/ChatMessage";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";

const dot = (status: string) =>
  status === "agreed" ? "bg-emerald-500" : status === "waiting_owner" ? "bg-amber-500" : status === "open" ? "bg-sky-500 animate-pulse" : "bg-zinc-400";

async function Channel({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewerId = await currentUserId();
  const [data, deals] = await Promise.all([getDealChannel(id, viewerId), listDealsFor(viewerId)]);
  if (!data) notFound();

  const { deal, rooms, messages, bookings, names } = data;
  const thread = Object.fromEntries(rooms.map((r) => [r.id, r.label ?? "deal"]));
  // Keep refreshing while agents talk, and in the gap before the mover leg starts.
  const active = rooms.some((r) => r.status === "open" || r.status === "waiting_owner") || (deal.status === "proposed" && !rooms.some((r) => r.label?.startsWith("Mover")));
  const net = rooms.reduce((sum, r) => {
    if (r.status !== "agreed" || !r.agreedPrice) return sum;
    return r.sellerId === viewerId ? sum + Number(r.agreedPrice) : r.buyerId === viewerId ? sum - Number(r.agreedPrice) : sum;
  }, 0);

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-[220px_1fr_280px]">
      <LiveRefresh active={active} />

      <aside className="overflow-y-auto border-r bg-muted/30 p-3 text-sm">
        <p className="mb-2 px-2 text-xs font-semibold uppercase text-muted-foreground">Deals</p>
        {deals.map((d) => (
          <div key={d.id}>
            <Link href={`/deals/${d.id}`} className={`block rounded-lg px-2 py-1 ${d.id === deal.id ? "bg-accent font-semibold" : "hover:bg-muted"}`}>
              # {d.title.toLowerCase().replace(/\s+/g, "-")}
            </Link>
            {d.id === deal.id &&
              rooms.map((r) => (
                <Link key={r.id} href={`/rooms/${r.id}`} className="flex items-center gap-2 py-1 pl-5 text-muted-foreground hover:text-foreground">
                  <span className={`size-2 rounded-full ${dot(r.status)}`} />
                  {r.label}
                </Link>
              ))}
          </div>
        ))}
      </aside>

      <section className="flex flex-col overflow-y-auto p-4">
        <h1 className="mb-3 text-lg font-semibold"># {deal.title.toLowerCase().replace(/\s+/g, "-")}</h1>
        {messages.length === 0 && <p className="text-sm text-muted-foreground">Agents are joining…</p>}
        <div className="flex flex-col gap-1">
          {messages.map((m) => (
            <ChatMessage
              key={m.id}
              m={m}
              viewerId={viewerId}
              name={names[m.fromUserId]?.split(" ")[0] ?? m.fromUserId}
              thread={thread[m.negotiationId]}
              waiting={rooms.find((r) => r.id === m.negotiationId)?.status === "waiting_owner"}
            />
          ))}
          {bookings.map((b) => (
            <p key={b.id} className="mx-2 my-1 rounded-xl bg-secondary px-3 py-2 text-sm">
              📅 {names[b.providerId]?.split(" ")[0]} is booked {b.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}–
              {b.endsAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · {b.title}
            </p>
          ))}
        </div>
      </section>

      <aside className="overflow-y-auto border-l p-4 text-sm">
        <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">Deal</p>
        <div className="flex flex-col gap-2">
          {rooms.map((r) => (
            <div key={r.id} className="flex items-center justify-between rounded-xl border p-2">
              <span className="flex items-center gap-2"><span className={`size-2 rounded-full ${dot(r.status)}`} />{r.label}</span>
              <span className="font-medium">
                {r.agreedPrice ? `${r.sellerId === viewerId ? "+" : "−"}$${Number(r.agreedPrice).toFixed(0)}` : r.status === "waiting_owner" ? "needs you" : r.status === "open" ? "…" : "—"}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-3 text-base font-semibold">
          <span>Net</span>
          <span>{net >= 0 ? "+" : "−"}${Math.abs(net).toFixed(0)}</span>
        </div>
        <p className="mt-6 mb-2 text-xs font-semibold uppercase text-muted-foreground">Saturday</p>
        <ul className="flex flex-col gap-1 text-muted-foreground">
          {rooms.map((r) => {
            const last = [...messages].reverse().find((m) => m.negotiationId === r.id && (m.terms as { when?: string }).when);
            const when = (last?.terms as { when?: string } | undefined)?.when;
            return when ? <li key={r.id}>🕒 {when}: {r.label}</li> : null;
          })}
        </ul>
      </aside>
    </div>
  );
}

export default function DealPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p className="p-8 text-muted-foreground">Loading deal…</p>}>
      <Channel params={params} />
    </Suspense>
  );
}
