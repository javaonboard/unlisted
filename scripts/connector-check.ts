// Connects to a user's Unlisted connector the way an AI app would.
//   npm run connector:check -- [userId] [baseUrl]
import { eq } from "drizzle-orm";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { db, schema } from "@/lib/db";

async function main() {
  const userId = process.argv[2] ?? "maya";
  const base = process.argv[3] ?? "http://localhost:3000";
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId));
  const url = `${base}/mcp/${user.connectorKey}`;

  const client = new Client({ name: "connector-check", version: "1.0.0" });
  await client.connect(new StreamableHTTPClientTransport(new URL(url)));

  const { tools } = await client.listTools();
  console.log("tools:", tools.map((t) => t.name).join(", "));

  const matches = await client.callTool({ name: "my_matches", arguments: {} });
  console.log("\nmy_matches:", (matches.content as { text: string }[])[0].text.slice(0, 600));

  const rooms = await client.callTool({ name: "room_status", arguments: {} });
  const list = JSON.parse((rooms.content as { text: string }[])[0].text);
  console.log(`\nroom_status: ${list.length} negotiations`, list.map((r: { status: string; agreedPrice: string }) => `${r.status}${r.agreedPrice ? ` $${r.agreedPrice}` : ""}`).join(", "));

  await client.close();
  process.exit(0);
}

main().catch((error) => {
  console.error(error?.message ?? error);
  process.exit(1);
});
