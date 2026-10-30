import { Suspense } from "react";
import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { myBookings } from "@/lib/bookings";
import { BackLink } from "@/components/anchors/BackLink";
import { ScheduleView } from "@/components/bryntum/ScheduleView";

// Local time as "YYYY-MM-DDTHH:mm", which Bryntum reads without shifting.
const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

async function MySchedule() {
  const userId = await currentUserId();
  const [user, bookings] = await Promise.all([getUser(userId), myBookings(userId)]);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const weekLater = new Date(today.getTime() + 7 * 86_400_000);
  const upcoming = bookings.filter((b) => b.endsAt > today).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());

  return (
    <>
      <ScheduleView
        from={local(today)}
        to={local(weekLater)}
        rows={[{ id: userId, name: user?.name.split(" ")[0] ?? "Me" }]}
        slots={upcoming.map((b) => ({ id: b.id, resourceId: userId, name: b.title, startDate: local(b.startsAt), endDate: local(b.endsAt), eventColor: b.roomId ? "green" : "gray" }))}
      />
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {upcoming.length === 0 && <li className="text-muted-foreground">Nothing booked this week.</li>}
        {upcoming.map((b) => (
          <li key={b.id} className="flex justify-between rounded-xl border p-3">
            <span>{b.roomId ? <Link href={`/rooms/${b.roomId}`} className="hover:underline">{b.title}</Link> : b.title}</span>
            <span className="text-muted-foreground">{b.startsAt.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}</span>
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
      <p className="mb-4 text-muted-foreground">Every handoff and job your agent agreed, plus what was already on your calendar.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <MySchedule />
      </Suspense>
    </main>
  );
}
