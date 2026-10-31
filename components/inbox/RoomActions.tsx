import Link from "next/link";
import { getRoomView } from "@/lib/anchors/queries";
import { nextFor, pillClass, pillText, roleOf } from "@/lib/anchors/next";
import { OwnerQuestion } from "@/components/deals/OwnerQuestion";
import { RoomNextSteps } from "@/components/rooms/RoomNextSteps";

// Under the latest message about a deal: who you are in it, where it stands, and what you can do now.
export async function RoomActions({ roomId, viewerId }: { roomId: string; viewerId: string }) {
  const data = await getRoomView(roomId, viewerId);
  if (!data) return null;
  const { room } = data;
  const role = roleOf(data, viewerId);
  const next = nextFor(data, viewerId);
  const question = [...data.messages].reverse().find((m) => m.kind === "ask_owner" && m.fromUserId === viewerId);

  return (
    <div className="mt-3 border-t pt-3">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="rounded-full border px-2 py-0.5">{role.badge}</span>
        <span className={`rounded-full px-2 py-0.5 ${pillClass(next)}`}>{pillText(next)}</span>
      </div>
      {room.status === "waiting_owner" && question && (
        <>
          <p className="mt-1 text-muted-foreground">{question.note}</p>
          <OwnerQuestion roomId={room.id} suggestedPrice={question.price ? Number(question.price) : null} />
        </>
      )}
      {room.status === "agreed" && <RoomNextSteps data={data} viewerId={viewerId} />}
      <Link href={`/rooms/${room.id}`} className="mt-2 inline-block text-xs text-primary hover:underline">See the chat ▸</Link>
    </div>
  );
}
