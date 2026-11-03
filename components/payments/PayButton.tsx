"use client";

import { useState } from "react";
import { PayPalProvider, PayPalOneTimePaymentButton } from "@paypal/react-paypal-js/sdk-v6";
import { createOrderAction, holdPaymentAction } from "@/app/actions/payments";
import { showDone } from "@/components/shared/Toaster";

// PayPal's own v6 button: one click opens PayPal, approving places a hold. Nothing is charged until the handoff.
export function PayButton({ legId, clientId, total, deposit }: { legId: string; clientId: string; total: number; deposit: number }) {
  const [status, setStatus] = useState<"idle" | "holding" | "error">("idle");

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm">
        Pay <span className="font-semibold">${(total + deposit).toFixed(0)}</span> with PayPal{deposit ? ` ($${total.toFixed(0)} + $${deposit.toFixed(0)} deposit)` : ""}. PayPal holds it and only charges after the handoff.
      </p>
      <PayPalProvider environment="sandbox" clientId={clientId} components={["paypal-payments"]} pageType="checkout">
        <PayPalOneTimePaymentButton
          presentationMode="auto"
          createOrder={() => createOrderAction(legId)}
          onApprove={async ({ orderId }) => {
            setStatus("holding");
            try {
              await holdPaymentAction(orderId);
              showDone(`Paid with PayPal. $${(total + deposit).toFixed(0)} is held until the handoff.`);
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
