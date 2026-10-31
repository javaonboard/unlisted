import Link from "next/link";
import { getRoomView } from "@/lib/anchors/queries";
import { OwnerQuestion } from "@/components/deals/OwnerQuestion";
import { RoomNextSteps } from "@/components/rooms/RoomNextSteps";

// Under the latest message about a deal: whatever the owner can do about it right now.
export async function RoomActions({ roomId, viewerId }: { roomId: string; viewerId: string }) {
  const data = await getRoomView(roomId, viewerId);
  if (!data) return null;
  const { room } = data;
  const question = [...data.messages].reverse().find((m) => m.kind === "ask_owner" && m.fromUserId === viewerId);

  return (
    <div className="mt-2">
      {room.status === "waiting_owner" && question && <OwnerQuestion roomId={room.id} suggestedPrice={question.price ? Number(question.price) : null} />}
      {room.status === "open" && <p className="text-xs text-muted-foreground">💬 The agents are talking…</p>}
      {room.status === "closed" && <p className="text-xs text-muted-foreground">Closed: {room.closedReason}</p>}
      {room.status === "agreed" && <RoomNextSteps data={data} viewerId={viewerId} />}
      <Link href={`/rooms/${room.id}`} className="mt-2 inline-block text-xs text-primary hover:underline">See the chat ▸</Link>
    </div>
  );
}
