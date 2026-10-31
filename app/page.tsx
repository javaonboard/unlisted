import { Suspense } from "react";
import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { listNotifications } from "@/lib/notifications/queries";
import { SuggestionCard } from "@/components/inbox/SuggestionCard";
import { RoomActions } from "@/components/inbox/RoomActions";
import { ScrollToEnd } from "@/components/inbox/ScrollToEnd";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";
import { TellAgent } from "@/components/vault/TellAgent";

const time = (d: Date) => d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

// The inbox is one chat with your own agent: questions, deals to confirm, payments, suggestions.
async function Inbox() {
  const userId = await currentUserId();
  const [user, notifications, suggestions] = await Promise.all([
    getUser(userId),
    listNotifications(userId),
    db.select().from(schema.suggestions).where(eq(schema.suggestions.userId, userId)).orderBy(desc(schema.suggestions.createdAt)),
  ]);

  // Oldest first, like a chat. Only the newest message about a deal carries its buttons.
  const thread = [
    ...notifications.map((n) => ({ type: "note" as const, at: n.createdAt, n })),
    ...suggestions.map((s) => ({ type: "suggestion" as const, at: s.createdAt, s })),
  ]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(-40);
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

      <div className="mt-6 flex flex-col gap-3">
        {thread.length === 0 && <p className="text-sm text-muted-foreground">Nothing yet. Tell your agent what you have or need.</p>}
        {thread.map((item) => {
          if (item.type === "suggestion") {
            const s = item.s;
            return (
              <Bubble key={s.id} at={s.createdAt}>
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
            <Bubble key={n.id} at={n.createdAt}>
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
function Bubble({ at, children }: { at: Date; children: React.ReactNode }) {
  return (
    <div className="flex max-w-[90%] gap-2 self-start">
      <div className="mt-1 flex size-7 shrink-0 items-center justify-center rounded-full bg-accent text-sm">🤖</div>
      <div className="min-w-0 flex-1 rounded-2xl border px-4 py-3 text-sm">
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
