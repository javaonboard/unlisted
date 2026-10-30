import { Suspense } from "react";
import { db, schema } from "@/lib/db";
import { MoverSchedule } from "@/components/bryntum/MoverSchedule";
import { nextSaturday } from "@/lib/dates";

async function Schedule() {
  const [bookings, users] = await Promise.all([db.select().from(schema.bookings), db.select().from(schema.users)]);
  const providers = [...new Set(bookings.map((b) => b.providerId))];
  const day = nextSaturday();
  const local = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <MoverSchedule
      day={local(day).slice(0, 10)}
      movers={providers.map((id) => ({ id, name: users.find((u) => u.id === id)?.name ?? id }))}
      jobs={bookings.map((b) => ({
        id: b.id,
        resourceId: b.providerId,
        name: b.title,
        startDate: local(b.startsAt),
        endDate: local(b.endsAt),
        eventColor: b.dealId ? "green" : "gray",
      }))}
    />
  );
}

export default function SchedulePage() {
  return (
    <main className="mx-auto w-full max-w-4xl p-8">
      <h1 className="mb-1 text-2xl font-semibold">Schedule</h1>
      <p className="mb-4 text-muted-foreground">Local providers&apos; Saturday. Green jobs were booked by agents.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Schedule />
      </Suspense>
    </main>
  );
}
