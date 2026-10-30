import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { addVaultItem } from "@/lib/vault/mutations";
import { listVault } from "@/lib/vault/queries";
import { postNeed } from "@/lib/intents/mutations";
import { discoverFor } from "@/lib/matching/discover";
import { getRoom, listRooms } from "@/lib/negotiation/queries";
import { startNegotiation } from "@/lib/negotiation/start";
import { listNotifications } from "@/lib/notifications/queries";

const CATEGORIES = "sofa, lighting, vr-headset, gpu, bike, tools, moving, gutters, lawn, it-setup, car-care";
const json = (value: unknown) => ({ content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }] });

// Unlisted as tools inside the user's own AI app (Claude, ChatGPT, ...).
// Every tool acts only for the user who owns this connector link.
export function unlistedServer(userId: string) {
  const server = new McpServer({ name: "unlisted", version: "1.0.0" });

  server.registerTool(
    "my_vault",
    { description: "List what the user owns and what they can do. Private items stay private until the user agrees to a buyer." },
    async () => json(await listVault(userId)),
  );

  server.registerTool(
    "add_to_vault",
    {
      description: `Remember something the user owns (goods) or can do (skill). Use a short category such as: ${CATEGORIES}.`,
      inputSchema: {
        kind: z.enum(["goods", "skill"]),
        title: z.string(),
        category: z.string(),
        condition: z.string().optional(),
        estimatedValue: z.number().optional().describe("USD"),
        minPrice: z.number().optional().describe("Least the user would accept, USD. Never shown to others."),
      },
    },
    async (item) => json(await addVaultItem(userId, item)),
  );

  server.registerTool(
    "post_need",
    {
      description: `Tell the marketplace what the user needs: something to buy or a local service. Categories: ${CATEGORIES}.`,
      inputSchema: {
        type: z.enum(["buy", "request_service"]),
        text: z.string().describe("The need in the user's words"),
        category: z.string(),
        maxPrice: z.number().optional().describe("Most the user would pay, USD"),
        dueInDays: z.number().optional(),
      },
    },
    async (need) => json(await postNeed(userId, need)),
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
      if (!roomId) return json(await listRooms(userId));
      const data = await getRoom(roomId);
      if (!data || (data.room.buyerId !== userId && data.room.sellerId !== userId)) return json({ error: "Room not found." });
      return json({
        status: data.room.status,
        agreedPrice: data.room.agreedPrice,
        messages: data.moves.map((m) => ({
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

  return server;
}
