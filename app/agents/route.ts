import { db, schema } from "@/lib/db";
import { baseUrl } from "@/lib/a2a/handler";

// A small public directory of Unlisted agents and their card URLs.
export async function GET(request: Request) {
  const base = baseUrl(request);
  const users = await db.select({ id: schema.users.id, name: schema.users.name }).from(schema.users);
  return Response.json(
    users
      .filter((u) => !u.id.startsWith("guest-"))
      .map((u) => ({ name: `${u.name}'s agent`, card: `${base}/agents/${u.id}/.well-known/agent-card.json` })),
  );
}
