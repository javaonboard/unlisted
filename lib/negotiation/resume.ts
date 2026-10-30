import { eq, max } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { playRoom } from "./room";

const QUIET = 5 * 60 * 1000;

// A restart or redeploy can stop a room mid-talk. Its messages are saved,
// so we just carry on from the last one.
export async function resumeStuckRooms() {
  const open = await db.select().from(schema.negotiations).where(eq(schema.negotiations.status, "open"));
  for (const room of open) {
    if (room.buyerId.startsWith("guest-")) continue; // an outside agent plays that side, we wait for it
    const [last] = await db.select({ at: max(schema.offers.createdAt) }).from(schema.offers).where(eq(schema.offers.negotiationId, room.id));
    const lastMove = last?.at ?? room.createdAt;
    if (Date.now() - lastMove.getTime() < QUIET) continue;
    console.log(`[room] ${room.id.slice(0, 8)} resumed after going quiet`);
    playRoom(room.id).catch((e) => console.error("[room] resume failed", room.id, e?.message));
  }
}
