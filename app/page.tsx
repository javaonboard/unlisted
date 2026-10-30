import { Suspense } from "react";
import Link from "next/link";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { getUser } from "@/lib/users/queries";
import { listNotifications } from "@/lib/notifications/queries";
import { and, desc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { SuggestionCard } from "@/components/inbox/SuggestionCard";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";

async function Inbox() {
  const userId = await currentUserId();
  const [user, notifications, suggestions] = await Promise.all([
    getUser(userId),
    listNotifications(userId),
    db.select().from(schema.suggestions).where(and(eq(schema.suggestions.userId, userId), eq(schema.suggestions.status, "new"))).orderBy(desc(schema.suggestions.createdAt)),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold">Hi {user?.name.split(" ")[0]}</h1>
      <p className="mt-1 text-muted-foreground">{user?.bio}</p>
      <div className="mt-2 flex gap-4 text-sm">
        <Link href="/schedule" className="text-primary hover:underline">My schedule ▸</Link>
        <Link href="/memory" className="text-primary hover:underline">What my agent knows about me ▸</Link>
      </div>

      <LiveRefresh active every={5000} />
      {suggestions.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 font-medium">Your agent suggests</h2>
          <div className="flex flex-col gap-3">
            {suggestions.map((s) => <SuggestionCard key={s.id} s={s} />)}
          </div>
        </>
      )}

      <h2 className="mt-8 mb-3 font-medium">Inbox</h2>
      {notifications.length === 0 && <p className="text-sm text-muted-foreground">Nothing new.</p>}
      <div className="flex flex-col gap-3">
        {notifications.map((n) => (
          <Link key={n.id} href={n.link ?? "/"}>
            <Card className="transition-colors hover:bg-muted/50">
              <CardHeader>
                <CardTitle>{n.title}</CardTitle>
                <CardDescription>{n.body}</CardDescription>
              </CardHeader>
            </Card>
          </Link>
        ))}
      </div>
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
