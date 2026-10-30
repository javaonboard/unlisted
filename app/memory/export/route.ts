import { currentUserId } from "@/lib/session";
import { listFacts } from "@/lib/memory/queries";

// Everything the agent knows about you, as a JSON download.
export async function GET() {
  const facts = await listFacts(await currentUserId());
  return new Response(JSON.stringify(facts, null, 2), {
    headers: { "Content-Type": "application/json", "Content-Disposition": 'attachment; filename="unlisted-memory.json"' },
  });
}
