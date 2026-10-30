import { baseUrl, cardFor } from "@/lib/a2a/handler";

export async function GET(request: Request, { params }: { params: Promise<{ user: string }> }) {
  const card = await cardFor((await params).user, baseUrl(request));
  return card ? Response.json(card) : new Response("unknown agent", { status: 404 });
}
