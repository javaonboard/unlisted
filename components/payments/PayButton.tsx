"use client";

import { useState } from "react";
import { PayPalProvider, PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import { createOrderAction, holdPaymentAction } from "@/app/actions/payments";

// PayPal's v6 button. Approving places a hold; nothing is charged until handoff.
export function PayButton({ dealId, clientId, total }: { dealId: string; clientId: string; total: number }) {
  const [status, setStatus] = useState<"idle" | "holding" | "error">("idle");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">Hold <span className="font-semibold">${total.toFixed(0)}</span> with PayPal. You&apos;re charged only after each handoff.</p>
      <PayPalProvider environment="sandbox" clientId={clientId} components={["paypal-payments"]} pageType="checkout">
        <PayPalOneTimePaymentButton
          presentationMode="auto"
          createOrder={() => createOrderAction(dealId)}
          onApprove={async ({ orderId }) => {
            setStatus("holding");
            try {
              await holdPaymentAction(orderId);
            } catch {
              setStatus("error");
            }
          }}
          onError={() => setStatus("error")}
        />
      </PayPalProvider>
      {status === "holding" && <p className="text-xs text-muted-foreground">Placing the hold…</p>}
      {status === "error" && <p className="text-xs text-destructive">Something went wrong. Try again.</p>}
    </div>
  );
}
