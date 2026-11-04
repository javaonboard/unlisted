import { NextSteps } from "@/components/rooms/NextSteps";
import type { getRoomView } from "@/lib/views/queries";

type RoomView = NonNullable<Awaited<ReturnType<typeof getRoomView>>>;

// The steps of an agreed deal, for the room page and the inbox.
export function RoomNextSteps({ data, viewerId, links = true }: { data: RoomView; viewerId: string; links?: boolean }) {
  const { room, deal, names } = data;
  return (
    <NextSteps
      roomId={room.id}
      dealId={room.dealId}
      isPlan={!!deal?.isPlan}
      viewerId={viewerId}
      buyerId={room.buyerId}
      sellerId={room.sellerId}
      first={(id) => names[id]?.split(" ")[0] ?? id}
      leg={data.leg}
      price={Number(room.agreedPrice ?? 0)}
      deposit={data.need?.type === "rent" ? Number(data.leg?.deposit ?? data.item.deposit ?? 0) : 0}
      booking={data.booking}
      waitingOn={data.waitingOn}
      meet={data.meet}
      places={data.places}
      stops={data.stops}
      rentalDays={data.need?.type === "rent" ? (data.need.days ?? 1) : null}
      blockedBy={data.blockedBy}
      overLimit={data.overLimit}
      clientId={process.env.PAYPAL_CLIENT_ID ?? ""}
      links={links}
    />
  );
}
