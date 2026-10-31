import { eq } from "drizzle-orm";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { db, schema } from "@/lib/db";
import { unlistedServer } from "@/lib/connector/server";

// The user's personal MCP connector link. The key in the URL decides whose tools these are.
async function handle(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const [user] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.connectorKey, key));
  if (!user) return new Response("unknown connector", { status: 404 });

  // Stateless: a fresh server and transport per request.
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
  await unlistedServer(user.id, new URL(request.url).origin).connect(transport);
  console.log("[mcp] request for", user.id);
  return transport.handleRequest(request);
}

export { handle as GET, handle as POST, handle as DELETE };
