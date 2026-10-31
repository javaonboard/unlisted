import { Suspense } from "react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { listNotifications } from "@/lib/notifications/queries";
import { needsYou } from "@/lib/inbox/needs";
import { SuggestionCard } from "@/components/inbox/SuggestionCard";
import { RoomActions } from "@/components/inbox/RoomActions";
import { ScrollToEnd } from "@/components/inbox/ScrollToEnd";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { TellAgent } from "@/components/vault/TellAgent";

const time = (d: Date) => d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

// The inbox is one chat with your own agent: questions, deals to confirm, payments, suggestions.
async function Inbox() {
  const userId = await currentUserId();
  const [user, notifications, suggestions, needs] = await Promise.all([
    getUser(userId),
    listNotifications(userId),
    db.select().from(schema.suggestions).where(eq(schema.suggestions.userId, userId)).orderBy(desc(schema.suggestions.createdAt)),
    needsYou(userId),
  ]);

  // Oldest first, like a chat. Only the newest message about a deal carries its buttons.
  const thread = [
    ...notifications.map((n) => ({ type: "note" as const, at: n.createdAt, n })),
    ...suggestions.map((s) => ({ type: "suggestion" as const, at: s.createdAt, s })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(-40);
  // The first thing in the chat that needs the owner, for the "needs you" link.
  const firstNeed = thread.find((t) => (t.type === "suggestion" ? needs.suggestionIds.includes(t.s.id) : t.n.roomId && needs.roomIds.includes(t.n.roomId)));
  const anchor = (t: (typeof thread)[number]) => (t.type === "suggestion" ? `s-${t.s.id}` : `n-${t.n.id}`);
  const latest = new Map(notifications.filter((n) => n.roomId).map((n) => [n.roomId!, n.id] as const).reverse()); // newest wins

  return (
    <>
      <LiveRefresh active every={5000} />
      <ScrollToEnd />
      <h1 className="text-2xl font-semibold">Hi {user?.name.split(" ")[0]}</h1>
      <div className="mt-1 flex gap-4 text-sm">
        <Link href="/schedule" className="text-primary hover:underline">My schedule ▸</Link>
        <Link href="/memory" className="text-primary hover:underline">What my agent knows about me ▸</Link>
      </div>

      {needs.count > 0 ? (
        <a href={firstNeed ? `#${anchor(firstNeed)}` : "#"} className="mt-4 inline-block rounded-full bg-red-100 px-3 py-1 text-sm text-red-800 hover:bg-red-200">
          🔴 {needs.count} {needs.count === 1 ? "thing needs" : "things need"} you ▸
        </a>
      ) : (
        <p className="mt-4 inline-block rounded-full bg-emerald-100 px-3 py-1 text-sm text-emerald-800">✅ Nothing needs you right now</p>
      )}

      <div className="mt-6 flex flex-col gap-3">
        {thread.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet. Tell your agent what you have or need.</p>}
        {thread.map((item) => {
          if (item.type === "suggestion") {
            const s = item.s;
            return (
              <Bubble key={s.id} id={anchor(item)} at={s.createdAt} needsYou={s.status === "new"}>
                {s.status === "new" ? <SuggestionCard s={s} /> : (
                  <p className="text-muted-foreground">💡 {s.title} · <span className="text-foreground">{s.status === "accepted" ? "✅ You said yes" : "Not now"}</span></p>
                )}
              </Bubble>
            );
          }
          const n = item.n;
          if (n.fromMe) {
            return <p key={n.id} className="max-w-[80%] self-end rounded-2xl bg-primary px-4 py-2 text-sm text-primary-foreground">{n.body}</p>;
          }
          return (
            <Bubble key={n.id} id={anchor(item)} at={n.createdAt} needsYou={!!n.roomId && latest.get(n.roomId) === n.id && needs.roomIds.includes(n.roomId)}>
              {n.title && <p className="font-medium">{n.title}</p>}
              <p className="text-muted-foreground">{n.body}</p>
              {n.roomId && latest.get(n.roomId) === n.id ? (
                <RoomActions roomId={n.roomId} viewerId={userId} />
              ) : n.link ? (
                <Link href={n.link} className="mt-1 inline-block text-xs text-primary hover:underline">Open ▸</Link>
              ) : null}
            </Bubble>
          );
        })}
      </div>

      <div className="mt-6"><TellAgent /></div>
    </>
  );
}

// A message from your agent.
function Bubble({ id, at, needsYou, children }: { id: string; at: Date; needsYou: boolean; children: React.ReactNode }) {
  return (
    <div id={id} className="flex max-w-[90%] scroll-mt-24 gap-2 self-start">
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm">🤖</div>
      <div className={`min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm ${needsYou ? "border-red-300 ring-1 ring-red-200" : ""}`}>
        {children}
        <p className="mt-2 text-[11px] text-muted-foreground">{time(at)}</p>
      </div>
    </div>
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
