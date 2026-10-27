import { randomUUID } from "node:crypto";
import {
  CheckoutPaymentIntent,
  OrdersController,
} from "@paypal/paypal-server-sdk";
import { paypalClient } from "./client";

const orders = () => new OrdersController(paypalClient());

type NewOrder = {
  amount: string; // "210.00"
  payeeEmail?: string; // who receives the money (empty = the platform)
  description: string;
  returnUrl?: string;
};

// Creates an order we can authorize now and capture later at handoff.
export async function createAuthorizeOrder(order: NewOrder) {
  const { result } = await orders().createOrder({
    paypalRequestId: randomUUID(),
    body: {
      intent: CheckoutPaymentIntent.Authorize,
      purchaseUnits: [
        {
          amount: { currencyCode: "USD", value: order.amount },
          payee: order.payeeEmail ? { emailAddress: order.payeeEmail } : undefined,
          description: order.description,
        },
      ],
      paymentSource: {
        paypal: {
          experienceContext: {
            returnUrl: order.returnUrl ?? "http://localhost:3000/paypal/return",
            cancelUrl: order.returnUrl ?? "http://localhost:3000/paypal/return",
          },
        },
      },
    },
  });

  const approveUrl = result.links?.find(
    (link) => link.rel === "payer-action" || link.rel === "approve",
  )?.href;

  console.log("[paypal] order created", result.id, result.status);
  return { orderId: result.id!, approveUrl };
}

// Places the hold after the payer approves. Returns the authorization id.
export async function authorizeOrder(orderId: string) {
  const { result } = await orders().authorizeOrder({
    id: orderId,
    paypalRequestId: randomUUID(),
  });

  const authorization =
    result.purchaseUnits?.[0]?.payments?.authorizations?.[0];
  console.log("[paypal] order authorized", orderId, authorization?.status);
  return { authorizationId: authorization?.id, status: authorization?.status };
}

export async function getOrder(orderId: string) {
  const { result } = await orders().getOrder({ id: orderId });
  return result;
}
