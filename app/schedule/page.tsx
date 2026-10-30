import { Suspense } from "react";
import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { myBookings, waitingOn } from "@/lib/bookings";
import { BackLink } from "@/components/anchors/BackLink";
import { ScheduleView } from "@/components/bryntum/ScheduleView";
import { Button } from "@/components/ui/button";
import { freeTimes } from "@/lib/availability";
import { clearFreeAction, markFreeAction, moveBookingAction } from "@/app/actions/schedule";

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

  return (
    <>
      <ScheduleView
        from={local(today)}
        to={local(weekLater)}
        rows={[{ id: userId, name: user?.name.split(" ")[0] ?? "Me" }]}
        slots={upcoming.map((b) => ({ id: b.id, resourceId: userId, name: b.title, startDate: local(b.startsAt), endDate: local(b.endsAt), eventColor: !b.roomId ? "gray" : status(b.roomId) ? "orange" : "green", draggable: !!b.roomId }))}
        free={free.map((f) => ({ id: f.id, resourceId: userId, startDate: local(f.startsAt), endDate: local(f.endsAt) }))}
        onFree={markFreeAction}
        onMove={moveBookingAction}
      />
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Drag across empty time to mark yourself free; agents then only pick times inside it. Drag a bar to ask for another time.</span>
        {free.length > 0 && <form action={clearFreeAction}><Button size="sm" variant="ghost">Clear free hours</Button></form>}
      </div>
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {upcoming.length === 0 && <li className="text-muted-foreground">Nothing booked this week.</li>}
        {upcoming.map((b) => (
          <li key={b.id} className="flex justify-between rounded-xl border p-3">
            <span>{b.roomId ? <Link href={`/rooms/${b.roomId}`} className="hover:underline">{b.title}</Link> : b.title}</span>
            <span className="text-muted-foreground">
              {status(b.roomId) && <span className="mr-2 rounded-full bg-orange-100 px-2 py-0.5 text-xs text-orange-800">{status(b.roomId)}</span>}
              {b.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}
            </span>
          </li>
        ))}
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
