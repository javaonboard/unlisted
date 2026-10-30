import { ServerCallContext } from "@a2a-js/sdk/server";
import { a2aHandlerFor, baseUrl } from "@/lib/a2a/handler";

// A2A JSON-RPC endpoint for one user's agent.
export async function POST(request: Request, { params }: { params: Promise<{ user: string }> }) {
  const handler = await a2aHandlerFor((await params).user, baseUrl(request));
  if (!handler) return new Response("unknown agent", { status: 404 });

  const context = new ServerCallContext({ requestedVersion: request.headers.get("a2a-version") ?? "1.0" });
  const result = await handler.handle(await request.json(), context);
  if (Symbol.asyncIterator in result) return new Response("streaming is not supported", { status: 400 });
  console.log("[a2a] request for", (await params).user);
  return Response.json(result);
}
