// Day-1 check: can the platform hold money for another account,
// then capture, void and refund it?
//
//   npm run paypal:check -- create <payeeEmail> <amount>
//   npm run paypal:check -- authorize <orderId>
//   npm run paypal:check -- capture <authorizationId> [amount]
//   npm run paypal:check -- void <authorizationId>
//   npm run paypal:check -- refund <captureId> <amount>
import { createAuthorizeOrder, authorizeOrder, getOrder } from "@/lib/paypal/orders";
import {
  captureAuthorization,
  voidAuthorization,
  refundCapture,
} from "@/lib/paypal/payments";

const [command, a, b] = process.argv.slice(2);

async function main() {
  switch (command) {
    case "create": {
      const order = await createAuthorizeOrder({
        payeeEmail: a,
        amount: b,
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
    case "order":
      return console.log(JSON.stringify(await getOrder(a), null, 2));
    default:
      console.log("Commands: create | authorize | capture | void | refund | order");
  }
}

main().catch((error) => {
  console.error(error?.result ?? error);
  process.exit(1);
});
