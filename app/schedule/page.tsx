import { Suspense } from "react";
import { SubmitButton } from "@/components/ui/submit-button";
import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { myBookings, waitingOn } from "@/lib/bookings";
import { BackLink } from "@/components/shared/BackLink";
import { ScheduleView } from "@/components/bryntum/ScheduleView";
import { freeTimes } from "@/lib/availability";
import { clearFreeAction, markFreeAction, moveBookingAction } from "@/app/actions/schedule";
import { getRoomView } from "@/lib/views/queries";
import { nextFor, roleOf } from "@/lib/views/next";
import { RoleBadge, StatusPill } from "@/components/shared/Badges";
import { AcceptDeal } from "@/components/rooms/AcceptDeal";

// Local time as "YYYY-MM-DDTHH:mm", which Bryntum reads without shifting.
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

async function MySchedule() {
  const userId = await currentUserId();
  const [user, bookings, free] = await Promise.all([getUser(userId), myBookings(userId), freeTimes(userId)]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekLater = new Date(today.getTime() + 3 * 86_400_000); // the next three days, hour by hour
  const upcoming = bookings.filter((b) => b.endsAt > today).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
  const waiting = await waitingOn(upcoming.flatMap((b) => (b.roomId ? [b.roomId] : [])));
  const status = (roomId: string | null) => {
    const who = roomId ? waiting[roomId] : [];
    return !who.length ? null : who.includes(userId) ? "Waiting for you" : "Waiting for them";
  };
  // Each deal's role and next step, the same as in the inbox.
  const views = Object.fromEntries(
    await Promise.all(upcoming.filter((b) => b.roomId).map(async (b) => [b.roomId!, await getRoomView(b.roomId!, userId)] as const)),
  );

  // The person on the other side of each booking, and what the bar shows.
  const people = new Map<string, { name: string; role: string }>();
  const slots = upcoming.map((b) => {
    const view = b.roomId ? views[b.roomId] : null;
    const when = `${b.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}`;
    if (!view) return { b, other: null, slot: { id: b.id, name: b.title, label: "", tip: `${b.title}<br>${when}`, iconCls: "fa fa-clock", startDate: local(b.startsAt), endDate: local(b.endsAt), eventColor: "gray", draggable: false } };
    const { room, item, names } = view;
    const kind = roleOf(view, userId).kind;
    const otherId = room.buyerId === userId ? room.sellerId : room.buyerId;
    const service = item.kind === "skill";
    const role = kind === "renter" ? "Lends to you" : kind === "lender" ? "Rents from you" : room.buyerId === userId ? (service ? "Does the job" : "Sells to you") : (service ? "Hired you" : "Buys from you");
    people.set(otherId, { name: names[otherId] ?? otherId, role });
    const price = room.agreedPrice ? `$${Math.round(Number(room.agreedPrice))}` : "";
    const next = nextFor(view, userId);
    const tip = `<b>${b.title}</b><br>${when}${price ? ` · ${price}` : ""}<br>${next.label}`;
    const iconCls = service ? "fa fa-truck" : kind === "renter" || kind === "lender" ? "fa fa-rotate" : room.buyerId === userId ? "fa fa-bag-shopping" : "fa fa-tag";
    return { b, other: otherId, slot: { id: b.id, name: b.title, label: price, tip, iconCls, startDate: local(b.startsAt), endDate: local(b.endsAt), eventColor: status(b.roomId) ? "orange" : "green", draggable: true } };
  });

  return (
    <>
      <ScheduleView
        me={userId}
        from={local(today)}
        to={local(weekLater)}
        rows={[{ id: userId, name: user?.name ?? "Me", role: "You", eventColor: "blue" }, ...[...people].map(([id, p]) => ({ id, name: p.name, role: p.role, eventColor: "gray" }))]}
        slots={slots.map(({ slot, other }) => ({ ...slot, resourceIds: other ? [userId, other] : [userId] }))}
        free={free.map((f) => ({ id: f.id, resourceId: userId, startDate: local(f.startsAt), endDate: local(f.endsAt) }))}
        onFree={markFreeAction}
        onMove={moveBookingAction}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Drag across empty time to mark yourself free; agents then only pick times inside it. Drag a bar to ask for another time.</span>
        {free.length > 0 && <form action={clearFreeAction}><SubmitButton size="sm" variant="ghost">Clear free hours</SubmitButton></form>}
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {upcoming.length === 0 && <li className="text-muted-foreground">Nothing booked this week.</li>}
        {upcoming.map((b) => {
          const view = b.roomId ? views[b.roomId] : null;
          const next = view ? nextFor(view, userId) : null;
          return (
            <li key={b.id} className="rounded-xl border p-3">
              <div className="flex justify-between gap-2">
                <span>{b.roomId ? <Link href={`/rooms/${b.roomId}`} className="hover:underline">{b.title}</Link> : b.title}</span>
                <span className="shrink-0 text-muted-foreground">{b.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
              </div>
              {view && next && (
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <RoleBadge role={roleOf(view, userId)} />
                  <StatusPill next={next} />
                </div>
              )}
              {next && (next.state === "needs_you" || next.state === "waiting" || next.state === "upcoming") && next.label !== "Approve the plan" && (
                view?.meet && (
                  <AcceptDeal
                    roomId={b.roomId!}
                    canAccept={next.label.startsWith("Accept")}
                    place={{ meetAt: view.meet.meetAt, allowed: view.places, isSeller: view.room.sellerId === userId, other: (view.names[view.room.sellerId === userId ? view.room.buyerId : view.room.sellerId] ?? "").split(" ")[0] }}
                  />
                )
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

export default function SchedulePage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <BackLink href="/" label="Inbox" />
      <h1 className="mb-1 text-2xl font-semibold">My schedule</h1>
      <p className="mb-4 text-muted-foreground">Every handoff and job your agent agreed. Orange means someone still has to confirm the time.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <MySchedule />
      </Suspense>
    </main>
  );
}
