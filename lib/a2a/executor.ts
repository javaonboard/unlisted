import { createHash, randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { AgentEvent, type AgentExecutor, type ExecutionEventBus, type RequestContext } from "@a2a-js/sdk/server";
import { Role, TaskState, type Message, type Part } from "@a2a-js/sdk";
import { db, schema } from "@/lib/db";
import { openRoom, playTurn, recordOutsideMove } from "@/lib/negotiation/room";
import type { Move } from "@/lib/negotiation/moves";

type IncomingMove = Partial<Move> & { itemId?: string; pickup?: string };

const text = (value: string): Part => ({ content: { $case: "text", value }, metadata: undefined, filename: "", mediaType: "" });
const data = (value: unknown): Part => ({ content: { $case: "data", value }, metadata: undefined, filename: "", mediaType: "application/json" });

function readMessage(message: Message) {
  let words = "";
  let move: IncomingMove | undefined;
  for (const part of message.parts) {
    if (part.content?.$case === "text") words += part.content.value;
    if (part.content?.$case === "data") move = part.content.value?.["unlisted.move"] ?? move;
  }
  return { words, move };
}

// One outside agent gets one guest user, named after its sender id.
async function guestFor(message: Message) {
  const sender = String(message.metadata?.from ?? "outside agent");
  const id = `guest-${createHash("sha256").update(sender).digest("hex").slice(0, 10)}`;
  await db.insert(schema.users).values({ id, name: `${sender} (outside agent)`, area: "remote", bio: "Connected over A2A." }).onConflictDoNothing();
  return id;
}

// The agent for one Unlisted user, reachable over A2A.
export class UnlistedAgent implements AgentExecutor {
  constructor(private ownerId: string) {}

  async execute(context: RequestContext, bus: ExecutionEventBus) {
    const { taskId, contextId } = context;
    const { words, move } = readMessage(context.userMessage);
    // Publishes our answer as the task's status, then tells the SDK we are done.
    const reply = (state: TaskState, parts: Part[]) => {
      bus.publish(
        AgentEvent.task({
          id: taskId,
          contextId,
          artifacts: [],
          history: [],
          metadata: undefined,
          status: {
            state,
            timestamp: new Date().toISOString(),
            message: { messageId: randomUUID(), contextId, taskId, role: Role.ROLE_AGENT, parts, metadata: undefined, extensions: [], referenceTaskIds: [] },
          },
        }),
      );
      bus.finished();
    };

    if (!move?.action) {
      return reply(TaskState.TASK_STATE_INPUT_REQUIRED, [text('Send a data part {"unlisted.move": {...}} as described in my agent card.')]);
    }

    // The A2A context id is the room id, so follow-ups land in the same room.
    let [room] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, contextId));
    const guestId = room?.buyerId ?? (await guestFor(context.userMessage));

    if (!room) {
      const [item] = move.itemId
        ? await db.select().from(schema.vaultItems).where(and(eq(schema.vaultItems.id, move.itemId), eq(schema.vaultItems.ownerId, this.ownerId)))
        : [];
      if (!item?.openToOffers) {
        return reply(TaskState.TASK_STATE_REJECTED, [text("That item is not open to offers. See my agent card for what is.")]);
      }
      const [intent] = await db
        .insert(schema.intents)
        .values({ ownerId: guestId, type: "buy", text: words || `Offer for ${item.title}`, category: item.category })
        .returning();
      room = await openRoom({ id: contextId, buyerId: guestId, sellerId: this.ownerId, itemId: item.id, intentId: intent.id });
    }

    await recordOutsideMove(
      room.id,
      guestId,
      { action: move.action, price: move.price ?? null, when: move.when ?? move.pickup ?? null, slotStart: null, place: move.place ?? null, meetAt: null, costs: move.costs ?? null, extras: move.extras ?? [], evidenceIds: [], message: words, askOwner: null, reasoning: "", signalsUsed: [] },
      { parts: context.userMessage.parts.map((p) => ({ [p.content?.$case ?? "text"]: p.content?.value })), role: "ROLE_USER", contextId },
    );
    await playTurn(room.id); // our agent answers, unless the room just closed

    const [after] = await db.select().from(schema.negotiations).where(eq(schema.negotiations.id, room.id));
    const [answer] = await db.select().from(schema.offers).where(eq(schema.offers.negotiationId, room.id)).orderBy(desc(schema.offers.round)).limit(1);
    const state =
      after.status === "agreed" ? TaskState.TASK_STATE_COMPLETED
      : after.status === "closed" ? TaskState.TASK_STATE_REJECTED
      : TaskState.TASK_STATE_INPUT_REQUIRED;

    // If the outside agent closed the room, confirm instead of echoing it.
    if (answer.fromUserId === guestId) {
      const words = after.status === "agreed"
        ? `Confirmed at $${Number(after.agreedPrice).toFixed(0)}. Both owners will approve payment with PayPal.`
        : "Understood, closing this negotiation.";
      return reply(state, [text(words), data({ "unlisted.move": { action: after.status === "agreed" ? "accept" : "reject", price: after.agreedPrice ? Number(after.agreedPrice) : null } })]);
    }

    const shared = { action: answer.kind, price: answer.price ? Number(answer.price) : null, ...(answer.terms as object) };
    return reply(state, [text(answer.note ?? ""), data({ "unlisted.move": shared })]);
  }

  async cancelTask() {}
}
