import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addVaultItem } from "@/lib/vault/mutations";
import { listVault } from "@/lib/vault/queries";
import { postNeed } from "@/lib/intents/mutations";
import { discoverFor } from "@/lib/matching/discover";
import { getRoom, listRooms } from "@/lib/negotiation/queries";
import { startNegotiation } from "@/lib/negotiation/start";
import { listNotifications } from "@/lib/notifications/queries";
import { eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { getRoomView } from "@/lib/anchors/queries";
import { nextFor, roleOf } from "@/lib/anchors/next";
import { needsYou } from "@/lib/inbox/needs";
import { myBookings } from "@/lib/bookings";
import { addFreeTime } from "@/lib/availability";
import { askForNewTime } from "@/lib/negotiation/owner";
import { playRoom } from "@/lib/negotiation/room";
import { changeMeetAt } from "@/lib/deals/meet";
import { understandText } from "@/lib/vault/understand";
import { asRecord, missing } from "@/lib/vault/card";
import { categoryRule, knownCategories } from "@/lib/vault/categories";
import { after } from "next/server";

const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

// Unlisted as tools inside the user's own AI app (Claude, ChatGPT, ...).
// Every tool acts only for the user who owns this connector link.
// It can read, prepare and propose. Anything that commits the user or moves money
// (accepting a deal, approving a plan, raising a limit, the PayPal hold, the handoff)
// is done by the user in the app, so those tools return a link instead.
export async function unlistedServer(userId: string, base: string) {
  const categories = categoryRule(await knownCategories());
  const inApp = (roomId: string) => `${base}/rooms/${roomId}`;
  const server = new McpServer({ name: "unlisted", version: "1.0.0" });

  server.registerTool(
    "my_stuff",
    { description: "List what the user owns and what they can do. Private items stay private until the user agrees to a buyer." },
    async () => json(await listVault(userId)),
  );

  server.registerTool(
    "add_to_my_stuff",
    {
      description: `Remember something the user owns (goods) or can do (skill). ${categories}`,
      inputSchema: {
        kind: z.enum(["goods", "skill"]),
        title: z.string(),
        category: z.string(),
        condition: z.string().optional(),
        estimatedValue: z.number().optional().describe("USD"),
        minPrice: z.number().optional().describe("Least the user would accept, USD. Never shown to others."),
        maxMiles: z.number().optional().describe("How far the user will travel or deliver, miles. 0 = pickup only. Default 5"),
      },
    },
    async (item) => {
      if (item.kind === "goods" && (item.minPrice === undefined || !item.condition)) return json({ error: "Ask the user for the condition and the lowest price they'd take first." });
      if (item.kind === "skill" && item.estimatedValue === undefined) return json({ error: "Ask the user for their price per job first." });
      return json(await addVaultItem(userId, { ...item, minPrice: item.minPrice ?? item.estimatedValue }));
    },
  );

  server.registerTool(
    "post_need",
    {
      description: `Tell the marketplace what the user needs: something to buy or a local service. ${categories}`,
      inputSchema: {
        type: z.enum(["buy", "request_service"]),
        text: z.string().describe("The need in the user's words"),
        category: z.string(),
        maxPrice: z.number().optional().describe("Most the user would pay, USD"),
        dueInDays: z.number().optional(),
        maxMiles: z.number().optional().describe("How far away is fine, miles. Default 10"),
      },
    },
    async (need) => {
      // The budget is the agent's spending limit, so a need can't go out without one.
      if (need.maxPrice === undefined || need.dueInDays === undefined) return json({ error: "Ask the user for their budget and by when first." });
      return json(await postNeed(userId, need));
    },
  );

  server.registerTool(
    "my_matches",
    { description: "People who want the user's things, and things or services that fit the user's needs." },
    async () => {
      const { demand, supply } = await discoverFor(userId);
      return json({
        buyersForYourThings: demand.map((d) => ({ itemId: d.item.id, item: d.item.title, buyers: d.buyers.map((b) => ({ name: b.name, intentId: b.intent.id, buyerId: b.intent.ownerId })) })),
        matchesForYourNeeds: supply.map((s) => ({ intentId: s.intent.id, need: s.intent.text, open: s.open.map((o) => ({ itemId: o.item.id, title: o.item.title, owner: o.name, sellerId: o.item.ownerId })), privateMatches: s.privateCount })),
      });
    },
  );

  server.registerTool(
    "start_negotiation",
    {
      description: "Let the user's Unlisted agent negotiate with the other side's agent. Use ids from my_matches. Nothing is binding until the user approves.",
      inputSchema: { itemId: z.string(), intentId: z.string(), buyerId: z.string(), sellerId: z.string() },
    },
    async (input) => {
      if (input.buyerId !== userId && input.sellerId !== userId) return json({ error: "The user must be the buyer or the seller." });
      const [item] = await db.select().from(schema.vaultItems).where(eq(schema.vaultItems.id, input.itemId));
      const [need] = await db.select().from(schema.intents).where(eq(schema.intents.id, input.intentId));
      if (!item || !need || item.ownerId !== input.sellerId || need.ownerId !== input.buyerId) return json({ error: "Those ids don't belong together." });
      if (item.ownerId !== userId && !item.openToOffers) return json({ error: "That item isn't open to offers." }); // private items stay private
      const room = await startNegotiation(input);
      return json({ roomId: room.id, status: "Agents are negotiating. Check back with room_status." });
    },
  );

  server.registerTool(
    "room_status",
    {
      description: "Show the user's negotiations, or one negotiation's messages and current deal.",
      inputSchema: { roomId: z.string().optional() },
    },
    async ({ roomId }) => {
      if (!roomId) {
        const rooms = await listRooms(userId);
        return json(rooms.map((r) => ({ roomId: r.id, item: r.item?.title, buyer: r.buyer?.name, seller: r.seller?.name, status: r.status, agreedPrice: r.agreedPrice })));
      }
      const data = await getRoom(roomId);
      if (!data || (data.room.buyerId !== userId && data.room.sellerId !== userId)) return json({ error: "Room not found." });
      return json({
        status: data.room.status,
        agreedPrice: data.room.agreedPrice,
        messages: data.moves.filter((m) => !["ask_owner", "owner_note"].includes(m.kind) || m.fromUserId === userId).map((m) => ({
          round: m.round,
          from: m.fromUserId === userId ? "your agent" : "their agent",
          move: m.kind,
          price: m.price,
          says: m.note,
          ...(m.fromUserId === userId ? { privateReasoning: m.reasoning } : {}),
        })),
      });
    },
  );

  server.registerTool(
    "my_inbox",
    { description: "The user's Unlisted notifications, newest first." },
    async () => json(await listNotifications(userId)),
  );

  server.registerTool(
    "what_needs_me",
    { description: "Deals waiting on the user, with who they are in each deal and the next step. Approvals happen in the Unlisted app at the given link." },
    async () => {
      const { roomIds, suggestionIds } = await needsYou(userId);
      const deals = await Promise.all(
        roomIds.map(async (id) => {
          const view = (await getRoomView(id, userId))!;
          return { roomId: id, deal: roleOf(view, userId).title, role: roleOf(view, userId).badge, nextStep: nextFor(view, userId).label, finishInApp: inApp(id) };
        }),
      );
      return json({ deals, suggestionsWaiting: suggestionIds.length, suggestionsInApp: base });
    },
  );

  server.registerTool(
    "my_schedule",
    { description: "The user's upcoming handoffs and jobs, with whether both sides accepted and where to meet. Street addresses only appear once the payment is held." },
    async () => {
      const now = new Date();
      const rows = (await myBookings(userId)).filter((b) => b.endsAt > now).sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime());
      return json(
        await Promise.all(
          rows.map(async (b) => {
            const view = b.roomId ? await getRoomView(b.roomId, userId) : null;
            return {
              what: b.title,
              starts: b.startsAt.toISOString(),
              ends: b.endsAt.toISOString(),
              status: view ? nextFor(view, userId).label : "on your calendar",
              meet: view?.meet ? { where: view.meet.label, address: view.meet.address } : null,
              roomId: b.roomId,
            };
          }),
        ),
      );
    },
  );

  server.registerTool(
    "mark_free_hours",
    {
      description: "Mark hours the user is free. Once they have any, agents only pick times inside them.",
      inputSchema: { start: z.string().describe("ISO time"), end: z.string().describe("ISO time") },
    },
    async ({ start, end }) => {
      await addFreeTime(userId, new Date(start), new Date(end));
      return json({ ok: true });
    },
  );

  server.registerTool(
    "change_time",
    {
      description: "Ask for another time on an agreed deal, in the user's words. The agents settle it; the other person accepts in the app.",
      inputSchema: { roomId: z.string(), words: z.string().describe("e.g. 'Sunday after 2pm works better'") },
    },
    async ({ roomId, words }) => {
      const view = await getRoomView(roomId, userId);
      if (!view || view.room.status !== "agreed") return json({ error: "No agreed deal with that id." });
      await askForNewTime(roomId, userId, words);
      after(() => playRoom(roomId).catch((e) => console.error("[room] failed", roomId, e?.message)));
      return json({ ok: true, status: "The agents are finding a new time." });
    },
  );

  server.registerTool(
    "change_place",
    {
      description: "Change where to meet on an agreed deal. The other person accepts the change in the app.",
      inputSchema: { roomId: z.string(), meetAt: z.enum(["seller_home", "buyer_home", "public"]) },
    },
    async ({ roomId, meetAt }) => {
      const view = await getRoomView(roomId, userId);
      if (!view || view.room.status !== "agreed") return json({ error: "No agreed deal with that id." });
      await changeMeetAt(roomId, userId, meetAt);
      return json({ ok: true });
    },
  );

  server.registerTool(
    "tell_agent",
    {
      description: "Pass on what the user said they have, can do, or need. If something important is missing (budget, timing, lowest price...), you get a question to ask the user; call again with their answer added. Saves when complete.",
      inputSchema: { text: z.string().describe("Everything the user said about it so far") },
    },
    async ({ text }) => {
      const { cards, question } = await understandText(text);
      if (!cards.length) return json({ question: question ?? "What do you have, offer or need?" });
      if (cards.some((c) => missing(c).length)) return json({ question, draft: cards });
      for (const c of cards) {
        if (c.kind === "need") {
          await postNeed(userId, { type: c.needType ?? "buy", text: c.details ? `${c.title}. ${c.details}` : c.title, category: c.category, maxPrice: c.maxPrice!, dueInDays: c.dueInDays!, maxMiles: c.maxMiles ?? undefined, constraints: asRecord(c.requirements), days: c.days ?? undefined });
        } else {
          await addVaultItem(userId, { kind: c.kind, title: c.title, category: c.category, condition: c.condition ?? undefined, estimatedValue: c.value ?? undefined, minPrice: c.kind === "goods" ? (c.minPrice ?? undefined) : c.value!, details: { ...(c.details ? { notes: c.details } : {}), ...asRecord(c.specs) }, maxMiles: c.maxMiles ?? undefined, forSale: c.kind === "goods" ? !c.ways?.length || c.ways.includes("sell") : undefined, rentPerDay: c.ways?.includes("rent") ? (c.rentPerDay ?? undefined) : undefined, deposit: c.ways?.includes("rent") ? (c.deposit ?? undefined) : undefined });
          for (const h of c.freeHours) await addFreeTime(userId, new Date(h.start), new Date(h.end));
        }
      }
      return json({ saved: cards.map((c) => c.title) });
    },
  );

  server.registerTool(
    "finish_in_app",
    {
      description: "Accepting a deal, approving a plan, answering the agent about a higher limit, the PayPal hold and the handoff are done by the user in the Unlisted app. Returns the link for a deal.",
      inputSchema: { roomId: z.string() },
    },
    async ({ roomId }) => {
      const view = await getRoomView(roomId, userId);
      if (!view) return json({ error: "Room not found." });
      return json({ nextStep: nextFor(view, userId).label, link: inApp(roomId) });
    },
  );

  return server;
}
