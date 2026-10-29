import { verifyWebhook } from "@/lib/paypal/webhooks";
import { safePayPalError } from "@/lib/paypal/errors";

export async function POST(request: Request) {
  const rawBody = await request.text();

  try {
    if (!(await verifyWebhook(request.headers, rawBody))) {
      console.warn("[webhook] rejected: signature check failed");
      return new Response("invalid signature", { status: 400 });
    }
  } catch (error) {
    console.error("[webhook] verify failed", safePayPalError(error));
    return new Response("verify failed", { status: 500 });
  }

  const event = JSON.parse(rawBody);
  console.log("[webhook]", event.event_type, event.id, event.resource?.id);
  // Events get recorded in the activity log once the database is in.
  return new Response("ok");
}
