import { and, eq, lte, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { findDemandFor, findSupplyFor } from "@/lib/matching/matcher";
import { skillDemand } from "@/lib/items/demand";
import { milesBetween } from "@/lib/places";
import { suggest } from "./suggest";
import { toolOwnersFor } from "./tools";
import { checkIn } from "@/lib/agent/checkin";
import { priceItem } from "@/lib/pricing/save";
import { openRoom, playRoom } from "@/lib/negotiation/room";
import { inSentence } from "@/lib/text/words";

const WAIT = 2 * 3_600_000; // time to answer before the next wave

// Tools that hint at a service someone could offer.

const first = (name: string) => name.split(" ")[0];

// A need goes out in widening waves until someone answers:
// 1) the best 3 nearby, 2) the next 7, 3) people with the right tools, 4) back to the asker.
export async function runWave(needId: string, wave: number): Promise<void> {
  const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, needId));
  if (!need || need.status !== "open" || need.type === "sell" || wave > 4) return;

  const users = await db.select().from(schema.users);
  const asker = users.find((u) => u.id === need.ownerId)!;
  // Everyone already reached for this need: suggested to, or already talking.
  const asked = [
    ...(await db.select().from(schema.suggestions).where(eq(schema.suggestions.needId, needId))).map((s) => s.userId),
    ...(await db.select().from(schema.negotiations).where(eq(schema.negotiations.intentId, needId))).map((r) => r.sellerId),
  ];
  const typical = (await skillDemand(need.category, "")).perJob;
  let sent = 0;

  if (wave <= 2) {
    const supply = (await findSupplyFor(needId))
      .filter((item) => !asked.includes(item.ownerId))
      .map((item) => ({ item, miles: milesBetween(asker.area, users.find((u) => u.id === item.ownerId)!.area) }))
      .sort((a, b) => a.miles - b.miles)
      .slice(0, wave === 1 ? 3 : 7);

    for (const { item, miles } of supply) {
      // Already offered openly: their agent just starts talking. Private: ask first.
      if (item.openToOffers) {
        const room = await openRoom({ label: item.title, buyerId: need.ownerId, sellerId: item.ownerId, itemId: item.id, intentId: needId });
        await notify(item.ownerId, `I'm talking to ${first(asker.name)}`, `About “${need.text}”, ${miles} mi away. I'll ask you before anything is final.`, room.id);
        playRoom(room.id).catch((e) => console.error("[waves] room failed", e?.message));
        sent++;
        continue;
      }

      const ok = await suggest({
        userId: item.ownerId,
        needId,
        wave,
        kind: item.kind === "skill" ? "offer_skill" : "open_item",
        title: item.kind === "skill" ? `${first(asker.name)} needs ${inSentence(item.title)}` : `Someone wants your ${inSentence(item.title)}`,
        body: `${miles} mi away: “${need.text}”${typical && item.kind === "skill" ? ` · jobs like this pay ~$${typical}` : ""}. Want your agent to talk to them?`,
        action: { itemId: item.id, needId, label: "Talk to them" },
      });
      if (ok) sent++;
    }
  }

  // Wave 3: people whose things would let them do the job, as the agent judges it.
  if (wave === 3 && need.type === "request_service") {
    for (const tool of (await toolOwnersFor(need)).filter((t) => !asked.includes(t.ownerId))) {
      const ok = await suggest({
        userId: tool.ownerId,
        needId,
        wave,
        kind: "add_skill",
        title: `Your ${inSentence(tool.title)} could earn money`,
        body: `${first(asker.name)} nearby needs ${inSentence(tool.skill)}${typical ? `, ~$${typical} a job` : ""}. Offer it?`,
        action: { needId, category: need.category, skill: tool.skill, value: typical ?? 0, label: "Offer it" },
      });
      if (ok) sent++;
    }
  }

  if (wave === 4) {
    const raised = Math.round(Number(need.maxPrice ?? typical ?? 50) * 1.15);
    await suggest({
      userId: need.ownerId,
      needId,
      wave,
      kind: "raise_offer",
      title: `No takers yet for “${need.text}”`,
      body: `Raise your budget to $${raised}, or be flexible on the day? Your agent will ask again.`,
      action: { needId, maxPrice: raised, label: `Raise to $${raised}` },
    });
  }

  await db
    .update(schema.intents)
    .set({ wave, nextWaveAt: wave < 4 ? new Date(Date.now() + WAIT) : null })
    .where(eq(schema.intents.id, needId));

  // Nobody to ask in this wave: widen right away instead of waiting.
  if (sent === 0 && wave < 4) return runWave(needId, wave + 1);
}

// A new need: start the waves, and let the planning agent look at the bigger picture.
export async function onNeedPosted(needId: string) {
  const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, needId));
  if (!need) return;
  await runWave(needId, 1);
  await checkIn(need.ownerId, `they posted “${need.text}”`);
  // The market changed for people whose things fit this need: their agents take a look too.
  if (need.type === "sell") return;
  const owners = [...new Set((await findSupplyFor(needId)).map((i) => i.ownerId))].filter((id) => id !== need.ownerId).slice(0, 5);
  for (const owner of owners) await checkIn(owner, `someone nearby posted “${need.text}”, which fits something of theirs`);
}

// Something new in someone's things: price advice first, then their agent takes a look.
// People who need it only hear if it's public; a private thing stays private.
export async function onItemAdded(itemId: string) {
  const [item] = await db.select().from(schema.items).where(eq(schema.items.id, itemId));
  if (!item) return;
  await priceItem(itemId).catch((e) => console.error("[price] failed", e?.message)); // web, Channel3 and our own sales
  await checkIn(item.ownerId, `they added ${item.title}`);
  if (!item.openToOffers) return;
  const askers = [...new Set((await findDemandFor(itemId)).map((n) => n.ownerId))].slice(0, 5);
  for (const asker of askers) await checkIn(asker, `a new listing nearby fits one of their needs: ${item.title}`);
}

// Needs whose wave had no answer in time move on to the next wave.
export async function runDueWaves() {
  const due = await db.select().from(schema.intents).where(and(eq(schema.intents.status, "open"), lte(schema.intents.nextWaveAt, new Date())));
  for (const need of due) await runWave(need.id, need.wave + 1);
}

// Everyone in a wave said "not now": move on without waiting.
export async function onDismissed(needId: string, wave: number) {
  const inWave = await db.select().from(schema.suggestions).where(and(eq(schema.suggestions.needId, needId), eq(schema.suggestions.wave, wave)));
  if (inWave.length && inWave.every((s) => s.status === "dismissed")) await runWave(needId, wave + 1);
}


// A deal was agreed: suggestions about the need it filled, or the goods it sold, are out of date for everyone.
export async function onDealAgreed(roomId: string) {
  const [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, roomId));
  if (!room) return;
  const [need] = await db.select({ type: schema.intents.type }).from(schema.intents).where(eq(schema.intents.id, room.intentId!));
  const [item] = await db.select({ kind: schema.items.kind }).from(schema.items).where(eq(schema.items.id, room.itemId!));
  await db.update(schema.suggestions).set({ status: "expired" }).where(and(eq(schema.suggestions.status, "new"), eq(schema.suggestions.needId, room.intentId!)));
  if (item?.kind === "goods" && need?.type !== "rent") {
    await db.update(schema.suggestions).set({ status: "expired" }).where(and(eq(schema.suggestions.status, "new"), sql`${schema.suggestions.action}->>'itemId' = ${room.itemId}`));
  }
}
