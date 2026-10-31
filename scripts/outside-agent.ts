// A tiny agent that does not run on Unlisted. It finds Sam's agent from its
// A2A card and haggles for his loveseat with simple rules, no AI.
//   npm run outside:agent -- [baseUrl]
import { randomUUID } from "node:crypto";
import { ClientFactory } from "@a2a-js/sdk/client";
import { Role, TaskState, type Message, type Part, type Task } from "@a2a-js/sdk";

const base = process.argv[2] ?? "http://localhost:3000";
const MY_LIMIT = 270;

// Next Saturday, 10am Austin time (15:00 UTC), for the pickup.
const sat = new Date();
sat.setUTCDate(sat.getUTCDate() + ((6 - sat.getUTCDay() + 7) % 7 || 7));
const saturday10 = `${sat.toISOString().slice(0, 10)}T15:00:00.000Z`;

const text = (value: string): Part => ({ content: { $case: "text", value }, metadata: undefined, filename: "", mediaType: "" });
const data = (value: unknown): Part => ({ content: { $case: "data", value }, metadata: undefined, filename: "", mediaType: "application/json" });

function theirMove(task: Task) {
  const parts = task.status?.message?.parts ?? [];
  const words = parts.find((p) => p.content?.$case === "text")?.content?.value as string;
  const move = parts.find((p) => p.content?.$case === "data")?.content?.value?.["unlisted.move"];
  return { words, move };
}

async function main() {
  const client = await new ClientFactory().createFromUrl(`${base}/agents/sam/.well-known/agent-card.json`, "");
  const card = await (await fetch(`${base}/agents/sam/.well-known/agent-card.json`)).json();
  const itemId = card.description.match(/itemId ([0-9a-f-]{36})/)?.[1];
  console.log("found:", card.name, "| item:", itemId);

  let contextId: string = randomUUID();
  let taskId = "";
  let myPrice = 230;
  let say = "Hi! I'm an outside agent shopping for a small sofa. Would you take $230? I can pick up Saturday morning.";
  let action = "offer";

  for (let turn = 1; turn <= 3; turn++) {
    const message: Message = {
      messageId: randomUUID(),
      contextId,
      taskId,
      role: Role.ROLE_USER,
      parts: [text(say), data({ "unlisted.move": { action, price: myPrice, when: "Sat 10am", slotStart: saturday10, meetAt: "public", itemId } })],
      metadata: { from: "Pat's shopping bot" },
      extensions: [],
      referenceTaskIds: [],
    };
    console.log(`\nme (${action}${action !== "accept" ? ` $${myPrice}` : ""}): ${say}`);

    const result = (await client.sendMessage({ tenant: "", message, configuration: undefined, metadata: undefined })) as Task;
    contextId = result.contextId;
    taskId = result.id;
    const { words, move } = theirMove(result);
    console.log(`sam's agent (${move?.action}${move?.price ? ` $${move.price}` : ""}): ${words}`);
    console.log(`task state: ${TaskState[result.status!.state]}`);

    if (result.status!.state !== TaskState.TASK_STATE_INPUT_REQUIRED) break;
    if (move?.price && move.price <= MY_LIMIT) {
      action = "accept";
      say = `Deal at $${move.price}. See you Saturday.`;
    } else {
      myPrice = Math.min(MY_LIMIT, Math.round((myPrice + (move?.price ?? myPrice)) / 2));
      action = "counter";
      say = `Could we meet at $${myPrice}?`;
    }
  }
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
