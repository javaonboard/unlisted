import { verifyWebhook } from "@/lib/paypal/webhooks";

export async function POST(request: Request) {
  const rawBody = await request.text();

  if (!(await verifyWebhook(request.headers, rawBody))) {
    console.warn("[webhook] rejected: signature check failed");
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(rawBody);
  console.log("[webhook]", event.event_type, event.id, event.resource?.id);
  // Events get recorded in the activity log once the database is in.
  return new Response("ok");
}
