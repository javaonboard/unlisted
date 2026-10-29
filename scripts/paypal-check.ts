// Day-1 check: can the platform hold money for another account,
// then capture, void and refund it?
//
//   npm run paypal:check -- create <amount> [payeeEmail]
//   npm run paypal:check -- authorize <orderId>
//   npm run paypal:check -- capture <authorizationId> [amount]
//   npm run paypal:check -- void <authorizationId>
//   npm run paypal:check -- refund <captureId> <amount>
//   npm run paypal:check -- payout <receiverEmail> <amount>
import { createAuthorizeOrder, authorizeOrder, getOrder } from "@/lib/paypal/orders";
import {
  captureAuthorization,
  voidAuthorization,
  refundCapture,
} from "@/lib/paypal/payments";
import { sendPayout } from "@/lib/paypal/payouts";
import { safePayPalError } from "@/lib/paypal/errors";

const [command, a, b] = process.argv.slice(2);

async function main() {
  switch (command) {
    case "create": {
      const order = await createAuthorizeOrder({
        amount: a,
        payeeEmail: b,
        description: "Unlisted check",
      });
      console.log("Open this link and approve as the buyer:\n", order.approveUrl);
      return console.log("orderId:", order.orderId);
    }
    case "authorize":
      return console.log(await authorizeOrder(a));
    case "capture":
      return console.log(await captureAuthorization(a, b));
    case "void":
      return voidAuthorization(a);
    case "refund":
      return console.log(await refundCapture(a, b));
    case "payout":
      return console.log(await sendPayout(a, b, "Unlisted check"));
    case "order":
      return console.log(JSON.stringify(await getOrder(a), null, 2));
    default:
      console.log("Commands: create | authorize | capture | void | refund | payout | order");
  }
}

main().catch((error) => {
  console.error(safePayPalError(error));
  process.exit(1);
});
