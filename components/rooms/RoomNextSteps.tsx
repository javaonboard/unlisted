import { NextSteps } from "@/components/rooms/NextSteps";
import type { getRoomView } from "@/lib/anchors/queries";

type RoomView = NonNullable<Awaited<ReturnType<typeof getRoomView>>>;

// The next steps of an agreed deal, for the room page and the inbox.
export function RoomNextSteps({ data, viewerId }: { data: RoomView; viewerId: string }) {
  const { room, deal, names } = data;
  return (
    <NextSteps
      roomId={room.id}
      dealId={room.dealId}
      isPlan={!!deal && deal.title !== room.label}
      isPlanOwner={deal?.ownerId === viewerId}
      planSettled={data.planSettled}
      hasLegs={data.hasLegs}
      viewerId={viewerId}
      first={(id) => names[id]?.split(" ")[0] ?? id}
      leg={data.leg}
      payTotal={data.payTotal}
      when={data.when}
      place={data.place}
      booking={data.booking}
      waitingOn={data.waitingOn}
      buyerId={room.buyerId}
      clientId={process.env.PAYPAL_CLIENT_ID ?? ""}
    />
  );
}
