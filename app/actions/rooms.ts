"use server";

import { redirect } from "next/navigation";
import { startNegotiation as start } from "@/lib/negotiation/start";

export async function startNegotiation(input: { buyerId: string; sellerId: string; itemId: string; intentId: string }) {
  const room = await start(input);
  redirect(`/rooms/${room.id}`);
}
