import { after } from "next/server";
import { openRoom, playRoom } from "./room";

// Opens a room and lets the agents negotiate after the response is sent.
export async function startNegotiation(input: { buyerId: string; sellerId: string; itemId: string; intentId: string }) {
  const room = await openRoom(input);
  after(() => playRoom(room.id).catch((error) => console.error("[room] failed", room.id, error?.message)));
  return room;
}
