"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { openRoom, playRoom } from "@/lib/negotiation/room";

// Opens a room and lets the agents negotiate after the response is sent.
export async function startNegotiation(input: { buyerId: string; sellerId: string; itemId: string; intentId: string }) {
  const room = await openRoom(input);
  after(() => playRoom(room.id).catch((error) => console.error("[room] failed", room.id, error?.message)));
  redirect(`/rooms/${room.id}`);
}
