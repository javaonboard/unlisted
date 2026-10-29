import { Suspense } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { currentUserId } from "@/lib/session";
import { getRoom } from "@/lib/negotiation/queries";
import { Transcript } from "@/components/rooms/Transcript";
import { LiveRefresh } from "@/components/rooms/LiveRefresh";

async function Room({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [data, viewerId] = await Promise.all([getRoom(id), currentUserId()]);
  if (!data) notFound();

  const { room, item, intent, moves, buyer, seller } = data;
  const names = { [buyer.id]: buyer.name, [seller.id]: seller.name };
  const last = moves.at(-1);
  const pickup = last ? (last.terms as { pickup?: string }).pickup : undefined;

  return (
    <>
      <LiveRefresh active={room.status === "open"} />
      <div className="grid gap-6 lg:grid-cols-[1fr_2fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Why they matched</CardTitle>
            <CardDescription>Found by the marketplace, not by a listing.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-2 text-sm">
            <p><span className="font-medium">{buyer.name}</span> asked: “{intent.text}”</p>
            <p><span className="font-medium">{seller.name}</span> owns: {item.title}</p>
            <ul className="list-disc pl-5 text-muted-foreground">
              <li>Same category: {item.category}</li>
              <li>Price ranges overlap (neither side sees the other&apos;s limit)</li>
              <li>Both in Austin: {buyer.area} and {seller.area}</li>
            </ul>
          </CardContent>
        </Card>

        <section>
          <h2 className="mb-3 font-medium">Agent conversation</h2>
          <Transcript moves={moves} viewerId={viewerId} names={names} />
        </section>

        <Card>
          <CardHeader>
            <CardTitle>Deal</CardTitle>
            <CardDescription>Round {room.round} of {room.maxRounds}</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <Badge variant={room.status === "agreed" ? "default" : "secondary"} className="self-start">
              {room.status === "open" ? "Negotiating…" : room.status === "agreed" ? "Agreed" : `Closed: ${room.closedReason}`}
            </Badge>
            {room.agreedPrice && <p className="text-2xl font-semibold">${Number(room.agreedPrice).toFixed(0)}</p>}
            {pickup && <p>Pickup: {pickup}</p>}
            {room.status === "agreed" && (
              <Button disabled className="whitespace-normal">Approve with PayPal</Button>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export default function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-6xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading room…</p>}>
        <Room params={params} />
      </Suspense>
    </main>
  );
}
