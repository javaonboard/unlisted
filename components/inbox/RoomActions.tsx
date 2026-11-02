import Link from "next/link";
import { FormattedText } from "@/components/FormattedText";
import { getRoomView } from "@/lib/views/queries";
import { nextFor, roleOf } from "@/lib/views/next";
import { RoleBadge, StatusPill } from "@/components/shared/Badges";
import { OwnerQuestion } from "@/components/deals/OwnerQuestion";
import { RoomNextSteps } from "@/components/rooms/RoomNextSteps";

// Under the latest message about a deal: who you are in it, where it stands, and what you can do now.
export async function RoomActions({ roomId, viewerId, header = true }: { roomId: string; viewerId: string; header?: boolean }) {
  const data = await getRoomView(roomId, viewerId);
  if (!data) return null;
  const { room } = data;
  const role = roleOf(data, viewerId);
  const next = nextFor(data, viewerId);
  const question = data.pendingAsk?.by === viewerId ? data.messages.find((m) => m.id === data.pendingAsk!.id) : undefined; // only the newest question, only for its owner

  return (
    <div className={header ? "mt-3 border-t pt-3" : "mt-2"}>
      {header && <div className="flex flex-wrap items-center gap-2 text-xs">
        <RoleBadge role={role} />
        <StatusPill next={next} />
        <span className="text-muted-foreground">{data.distance}</span>
      </div>}
      {room.status === "waiting_owner" && question && (
        <>
          <FormattedText text={question.note ?? ""} className="mt-1 text-muted-foreground" />
          <OwnerQuestion roomId={room.id} suggestedPrice={question.price ? Number(question.price) : null} />
        </>
      )}
      {room.status === "agreed" && <RoomNextSteps data={data} viewerId={viewerId} />}
      <Link href={`/rooms/${room.id}`} className="mt-2 inline-block text-xs text-primary hover:underline">See the chat</Link>
    </div>
  );
}
