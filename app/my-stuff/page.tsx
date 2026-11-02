import { Suspense } from "react";
import Link from "next/link";
import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { findDemandFor } from "@/lib/matching/matcher";
import { statusLine } from "@/lib/views/status";
import { AFTER_HANDOFF } from "@/lib/payments/states";
import { setVisibilityAction, setWaysAction } from "@/app/actions/edit";
import { WaysSwitch } from "@/components/items/WaysSwitch";
import { waysOf } from "@/lib/items/ways";
import { VisibilitySwitch } from "@/components/shared/VisibilitySwitch";
import { rangeOfNeed, rangeOfOffer, rangeText } from "@/lib/places";
import { ChevronRight, ClipboardList } from "lucide-react";
import { CategoryIcon } from "@/components/shared/Badges";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { PhotoToItems } from "@/components/items/PhotoToItems";
import { TellAgent } from "@/components/items/TellAgent";

async function MyStuff() {
  const userId = await currentUserId();
  const [items, needs, users, plans] = await Promise.all([
    db.select().from(schema.items).where(and(eq(schema.items.ownerId, userId), isNull(schema.items.soldAt))).orderBy(asc(schema.items.createdAt)),
    db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, userId), eq(schema.intents.status, "open"))),
    db.select().from(schema.users),
    db.select().from(schema.deals).where(eq(schema.deals.ownerId, userId)),
  ]);
  const names = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const ids = [...items.map((i) => i.id), ...needs.map((n) => n.id)];
  const rooms = ids.length
    ? await db.select().from(schema.negotiations).where(or(inArray(schema.negotiations.itemId, ids), inArray(schema.negotiations.intentId, ids)))
    : [];
  const interested = Object.fromEntries(await Promise.all(items.map(async (i) => [i.id, (await findDemandFor(i.id)).length] as const)));
  // Plans still running: some part is talking, or agreed but not handed over yet.
  const planRooms = plans.length ? await db.select().from(schema.negotiations).where(inArray(schema.negotiations.dealId, plans.map((p) => p.id))) : [];
  const planLegs = plans.length ? await db.select().from(schema.dealLegs).where(inArray(schema.dealLegs.dealId, plans.map((p) => p.id))) : [];
  const finished = (roomId: string) => AFTER_HANDOFF.includes(planLegs.find((l) => l.roomId === roomId)?.status ?? "");
  const activePlans = plans
    .filter((p) => p.isPlan && p.status !== "cancelled")
    .map((p) => {
      const parts = planRooms.filter((r) => r.dealId === p.id && r.status !== "closed");
      return { ...p, parts: parts.length, done: parts.filter((r) => finished(r.id)).length };
    })
    .filter((p) => p.done < p.parts);

  // One card per item, with where its negotiations stand.
  const itemGrid = (title: string, empty: string, list: typeof items, aside?: React.ReactNode) => (
    <>
      <div className="mt-8 mb-3 flex items-baseline justify-between gap-3 first:mt-0">
        <h2 className="font-medium">{title}</h2>
        {aside}
      </div>
      {list.length === 0 && <p className="text-sm text-muted-foreground">{empty}</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((item) => (
          <div key={item.id} className="rounded-2xl border hover:bg-muted/40">
          <Link href={`/my-stuff/${item.id}`} className="flex gap-3 p-3 pb-2">
            {item.photos[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.photos[0]} alt="" className="size-14 shrink-0 rounded-xl object-cover" />
            ) : (
              <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent text-primary"><CategoryIcon category={item.category} /></div>
            )}
            <div className="min-w-0">
              <p className="font-medium">{item.title}</p>
              <p className="truncate text-sm text-muted-foreground">{item.condition ?? item.category} · ~${Number(item.estimatedValue ?? 0).toFixed(0)}{item.kind === "skill" ? "/job" : ""}{item.rentPerDay ? ` · rent $${Number(item.rentPerDay).toFixed(0)}/day` : ""}{item.kind === "goods" && !item.forSale ? " · not for sale" : ""} · {rangeText(rangeOfOffer(item.maxMiles), true)}</p>
              <p className="mt-1 text-sm">{statusLine(rooms.filter((r) => r.itemId === item.id), names, userId, interested[item.id])}</p>
            </div>
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 pb-3 pl-20">
            <VisibilitySwitch action={setVisibilityAction.bind(null, item.id, !item.openToOffers)} open={item.openToOffers} />
            {item.kind === "goods" && <WaysSwitch ways={waysOf(item)} onChange={setWaysAction.bind(null, item.id)} />}
          </div>
          </div>
        ))}
      </div>
    </>
  );

  return (
    <>
      <LiveRefresh active={rooms.some((r) => r.status === "open") || (plans.length > 0 && !rooms.some((r) => r.dependsOn.length > 0))} />
      {activePlans.map((p) => (
        <Link key={p.id} href={`/deals/${p.id}`} className="mb-6 block rounded-2xl bg-accent p-4 text-sm hover:bg-accent/70">
          <span className="flex items-center gap-2"><ClipboardList className="size-4" /> Plan in progress: <span className="font-medium">{p.title}</span> · {p.done} of {p.parts} parts done <ChevronRight className="size-4" /></span>
        </Link>
      ))}

      <div className="mb-6"><TellAgent /></div>
      <PhotoToItems />

      {itemGrid("Things I have", "Nothing yet. Snap a photo of a room or garage.", items.filter((i) => i.kind === "goods"), <Link href="/my-stuff/past" className="text-sm text-primary hover:underline">Things I had</Link>)}
      {itemGrid("What I can do", "No services yet. Tell your agent, e.g. “I can clean gutters, I have a ladder”.", items.filter((i) => i.kind === "skill"))}

      <h2 className="mt-8 mb-3 font-medium">What I need</h2>
      <div className="flex flex-col gap-2">
        {needs.filter((n) => n.type !== "sell").map((need) => (
          <Link key={need.id} href={`/needs/${need.id}`} className="flex items-center justify-between rounded-2xl border p-3 text-sm hover:bg-muted/40">
            <span className="flex items-center gap-2"><CategoryIcon category={need.category} className="size-4 text-primary" /> “{need.text}” <span className="text-muted-foreground">· {rangeText(rangeOfNeed(need.maxMiles), false)}</span></span>
            <span className="flex items-center gap-1 text-muted-foreground">{statusLine(rooms.filter((r) => r.intentId === need.id), names, userId)} <ChevronRight className="size-4" /></span>
          </Link>
        ))}
        {needs.filter((n) => n.type !== "sell").length === 0 && <p className="text-sm text-muted-foreground">No open needs.</p>}
      </div>
    </>
  );
}

export default function MyStuffPage() {
  return (
    <main className="mx-auto w-full max-w-3xl p-8">
      <h1 className="text-2xl font-semibold">My stuff</h1>
      <p className="mt-1 mb-6 text-muted-foreground">What you own, what you can do, and what you need. Private until you say yes.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <MyStuff />
      </Suspense>
    </main>
  );
}
