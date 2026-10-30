import { and, eq } from "drizzle-orm";
import { DefaultRequestHandler, InMemoryTaskStore, JsonRpcTransportHandler } from "@a2a-js/sdk/server";
import { db, schema } from "@/lib/db";
import { agentCard } from "./card";
import { UnlistedAgent } from "./executor";

// Public origin, also behind Render's proxy.
export function baseUrl(request: Request) {
  const host = request.headers.get("x-forwarded-host") ?? new URL(request.url).host;
  const proto = request.headers.get("x-forwarded-proto") ?? new URL(request.url).protocol.replace(":", "");
  return `${proto}://${host}`;
}

export async function cardFor(userId: string, base: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  if (!user) return null;
  const items = await db
    .select({ id: schema.vaultItems.id, title: schema.vaultItems.title, kind: schema.vaultItems.kind })
    .from(schema.vaultItems)
    .where(and(eq(schema.vaultItems.ownerId, userId), eq(schema.vaultItems.openToOffers, true)));
  return agentCard(user, items, base);
}

// One handler per user, kept so follow-up messages find their task.
const handlers = new Map<string, JsonRpcTransportHandler>();

export async function a2aHandlerFor(userId: string, base: string) {
  const existing = handlers.get(userId);
  if (existing) return existing;
  const card = await cardFor(userId, base);
  if (!card) return null;
  const handler = new JsonRpcTransportHandler(new DefaultRequestHandler(card, new InMemoryTaskStore(), new UnlistedAgent(userId)));
  handlers.set(userId, handler);
  return handler;
}
