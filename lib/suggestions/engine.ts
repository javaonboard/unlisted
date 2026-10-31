import { and, eq, ilike, lte, or } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { notify } from "@/lib/notifications/notify";
import { findDemandFor, findSupplyFor } from "@/lib/matching/matcher";
import { skillDemand } from "@/lib/vault/demand";
import { milesBetween } from "@/lib/places";
import { suggest } from "./suggest";
import { suggestPlan } from "./plan";
import { openRoom, playRoom } from "@/lib/negotiation/room";
import { inSentence } from "@/lib/text/words";

const WAIT = 2 * 3_600_000; // time to answer before the next wave

// Tools that hint at a service someone could offer.
const TOOLS: Record<string, { words: string[]; skill: string }> = {
  gutters: { words: ["ladder"], skill: "Gutter cleaning" },
  lawn: { words: ["mower", "trimmer"], skill: "Lawn mowing" },
  "car-care": { words: ["socket", "jack", "wrench"], skill: "Oil changes at home" },
  moving: { words: ["truck", "dolly", "van"], skill: "Moving help" },
  washing: { words: ["pressure washer"], skill: "Pressure washing" },
};

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
        action: { itemId: item.id, needId },
      });
      if (ok) sent++;
    }
  }

  if (wave === 3 && TOOLS[need.category]) {
    const { words, skill } = TOOLS[need.category];
    const owners = await db
      .select()
      .from(schema.vaultItems)
      .where(and(eq(schema.vaultItems.kind, "goods"), or(...words.map((w) => ilike(schema.vaultItems.title, `%${w}%`)))));
    for (const tool of owners.filter((t) => t.ownerId !== need.ownerId && !asked.includes(t.ownerId))) {
      const ok = await suggest({
        userId: tool.ownerId,
        needId,
        wave,
        kind: "add_skill",
        title: `Your ${inSentence(tool.title)} could earn money`,
        body: `${first(asker.name)} nearby needs ${inSentence(skill)}${typical ? `, ~$${typical} a job` : ""}. Offer it?`,
        action: { needId, category: need.category, skill, value: typical ?? 0 },
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
      action: { needId, maxPrice: raised },
    });
  }

  await db
    .update(schema.intents)
    .set({ wave, nextWaveAt: wave < 4 ? new Date(Date.now() + WAIT) : null })
    .where(eq(schema.intents.id, needId));

  // Nobody to ask in this wave: widen right away instead of waiting.
  if (sent === 0 && wave < 4) return runWave(needId, wave + 1);
}

// A new need: start the waves, and suggest what usually goes with it.
export async function onNeedPosted(needId: string) {
  const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, needId));
  if (!need) return;
  await runWave(needId, 1);
  await suggestPlan(need.ownerId); // a sale and a purchase that go together

  // Life event: someone moving usually needs a mover too.
  if (/\bmov(e|ing)\b/i.test(need.text) && need.category !== "moving") {
    const [hasMover] = await db.select().from(schema.intents).where(and(eq(schema.intents.ownerId, need.ownerId), eq(schema.intents.category, "moving"), eq(schema.intents.status, "open")));
    if (!hasMover) {
      await suggest({
        userId: need.ownerId,
        kind: "post_need",
        title: "Need a mover too?",
        body: "You mentioned moving. Want your agent to find someone with a truck for the day?",
        action: { type: "request_service", category: "moving", text: "Mover for moving day" },
      });
    }
  }
}

// Something new in a vault: tell the owner if people already want it.
export async function onVaultAdded(itemId: string) {
  const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, itemId));
  if (!item) return;
  const demand = await findDemandFor(itemId);
  if (!demand.length) return;

  const typical = (await skillDemand(item.category, item.ownerId)).perJob;
  await suggest({
    userId: item.ownerId,
    needId: demand[0].id,
    kind: item.kind === "skill" ? "offer_skill" : "open_item",
    title: item.kind === "skill" ? `${demand.length} neighbors need ${inSentence(item.title)}` : `${demand.length} ${demand.length === 1 ? "person wants" : "people want"} something like your ${inSentence(item.title)}`,
    body: item.kind === "skill" && typical ? `Jobs like this pay ~$${typical}. Let your agent take the closest one?` : "Want your agent to talk to the best one?",
    action: { itemId, needId: demand[0].id },
  });
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

