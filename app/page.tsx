import { Suspense } from "react";
import Link from "next/link";
import { and, desc, eq, or } from "drizzle-orm";
import { inPlanOrder, planSteps } from "@/lib/deals/order";
import { Bot, Check, CircleAlert } from "lucide-react";
import { db, schema } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { listNotifications } from "@/lib/notifications/queries";
import { getRoomView } from "@/lib/views/queries";
import { nextFor, roleOf } from "@/lib/views/next";
import { SuggestionCard } from "@/components/inbox/SuggestionCard";
import { DealThread } from "@/components/inbox/DealThread";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { TellAgent } from "@/components/items/TellAgent";
import { FormattedText } from "@/components/FormattedText";

const time = (d: Date) => d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

// The inbox, one card per thing: deals that need you first, then what's in progress,
// with everything finished folded away. Each card keeps its own history.
async function Inbox() {
  const userId = await currentUserId();
  const [user, notifications, suggestions] = await Promise.all([
    getUser(userId),
    listNotifications(userId),
    db.select().from(schema.suggestions).where(eq(schema.suggestions.userId, userId)).orderBy(desc(schema.suggestions.createdAt)),
  ]);

  // One thread per deal, newest activity first.
  const roomIds = [...new Set(notifications.flatMap((n) => (n.roomId ? [n.roomId] : [])))];
  const threads = (
    await Promise.all(
      roomIds.map(async (roomId) => {
        const view = await getRoomView(roomId, userId);
        if (!view) return null;
        const notes = notifications.filter((n) => n.roomId === roomId);
        const planId = view.deal?.isPlan && view.deal.ownerId === userId ? view.deal.id : null; // only the owner's own plans
        return { roomId, view, planId, next: nextFor(view, userId), role: roleOf(view, userId), notes, at: notes[0].createdAt };
      }),
    )
  ).filter((t) => t !== null);

  // Talks that ended without a deal: how they ended, so the chat is never lost.
  const ended = (await db.select().from(schema.negotiations).where(and(or(eq(schema.negotiations.buyerId, userId), eq(schema.negotiations.sellerId, userId)), eq(schema.negotiations.status, "closed"))))
    .filter((r) => !roomIds.includes(r.id))
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 10);
  const lastPrices = Object.fromEntries(
    await Promise.all(
      ended.map(async (r) => {
        const moves = (await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, r.id))).filter((m) => m.price && !["ask_owner", "owner_note"].includes(m.kind)).sort((a, b) => b.round - a.round);
        const mine = moves.find((m) => m.fromUserId === userId)?.price;
        const theirs = moves.find((m) => m.fromUserId !== userId)?.price;
        const at = (n: string) => `$${Number(n).toFixed(0)}`;
        return [r.id, !mine || !theirs ? "" : mine === theirs ? ` · both at ${at(mine)}` : ` · you ${at(mine)}, them ${at(theirs)}`] as const;
      }),
    ),
  );

  // A plan's parts show together, in the order to approve them.
  const steps = new Map<string, { step: number; total: number }>();
  for (const t of threads.filter((t, i, all) => t.planId && all.findIndex((o) => o.planId === t.planId) === i)) {
    const rooms = await db.select().from(schema.negotiations).where(eq(schema.negotiations.dealId, t.planId!));
    for (const [id, s] of planSteps(rooms, t.view.deal!)) steps.set(id, s);
  }

  const open = suggestions.filter((s) => s.status === "new");
  const answered = suggestions.filter((s) => s.status !== "new");
  const needsYou = inPlanOrder(threads.filter((t) => t.next.state === "needs_you"), steps);
  const going = inPlanOrder(threads.filter((t) => ["waiting", "upcoming", "talking"].includes(t.next.state)), steps);
  const done = threads.filter((t) => t.next.state === "done");
  const updates = notifications.filter((n) => !n.roomId && !n.fromMe);
  const count = needsYou.length + open.length;

  const thread = (t: (typeof threads)[number], expanded: boolean) => (
    <DealThread key={t.roomId} roomId={t.roomId} item={{ kind: t.view.item.kind, photos: t.view.item.photos }} viewerId={userId} role={t.role} next={t.next} distance={t.view.distance} plan={t.planId ? `${steps.has(t.roomId) ? `step ${steps.get(t.roomId)!.step} of ${steps.get(t.roomId)!.total} in ` : "part of "}your ${t.view.deal!.title} plan` : null} notes={t.notes} open={expanded} />
  );

  return (
    <>
      <LiveRefresh active every={5000} />
      <h1 className="text-2xl font-semibold">Hi {user?.name.split(" ")[0]}</h1>
      <div className="mt-1 flex gap-4 text-sm">
        <Link href="/money" className="text-primary hover:underline">My money</Link>
        <Link href="/memory" className="text-primary hover:underline">What my agent knows about me</Link>
      </div>

      <div className="mt-4"><TellAgent /></div>

      <h2 className="mt-6 mb-2 flex items-center gap-2 font-medium">
        {count ? <CircleAlert className="size-4 text-primary" /> : <Check className="size-4 text-emerald-700" />}
        {count ? `Needs you (${count})` : "Nothing needs you right now"}
      </h2>
      <div className="flex flex-col gap-3">
        {open.map((s) => <SuggestionCard key={s.id} s={s} />)}
        {needsYou.map((t) => thread(t, true))}
      </div>

      {going.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 font-medium">In progress</h2>
          <div className="flex flex-col gap-3">{going.map((t) => thread(t, false))}</div>
        </>
      )}

      {updates.length > 0 && (
        <>
          <h2 className="mt-6 mb-2 font-medium">Updates</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {updates.slice(0, 4).map((n) => (
              <li key={n.id} className="flex gap-2 rounded-xl border px-3 py-2">
                <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <span className="font-medium">{n.title}</span> <span className="text-xs text-muted-foreground">· {time(n.createdAt)}</span>
                  <FormattedText text={n.body} className="text-muted-foreground" />
                  {n.link && <Link href={n.link} className="text-xs text-primary hover:underline">Open</Link>}
                </div>
              </li>
            ))}
          </ul>
        </>
      )}

      {(done.length > 0 || answered.length > 0 || updates.length > 4 || ended.length > 0) && (
        <details className="mt-6">
          <summary className="cursor-pointer font-medium">Done ({done.length + ended.length + answered.length + Math.max(0, updates.length - 4)})</summary>
          <div className="mt-3 flex flex-col gap-3">
            {done.map((t) => thread(t, false))}
            {ended.map((r) => (
              <Link key={r.id} href={`/rooms/${r.id}`} className="rounded-xl border px-3 py-2 text-sm hover:bg-muted/40">
                <span className="font-medium">{r.label}</span>
                <span className="block text-muted-foreground">Ended: {r.closedReason ?? "no deal"}{lastPrices[r.id]} · see the chat</span>
              </Link>
            ))}
            {answered.map((s) => (
              <p key={s.id} className="rounded-xl border px-3 py-2 text-sm text-muted-foreground">{s.title} · <span className="text-foreground">{s.status === "accepted" ? "You said yes" : "Not now"}</span></p>
            ))}
            {updates.slice(4).map((n) => (
              <p key={n.id} className="rounded-xl border px-3 py-2 text-sm text-muted-foreground"><span className="text-foreground">{n.title}</span> · {time(n.createdAt)}</p>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Inbox />
      </Suspense>
    </main>
  );
}
