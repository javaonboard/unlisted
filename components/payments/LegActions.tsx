"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmHandoffAction, confirmReturnAction } from "@/app/actions/payments";

// The payer types the code the other side shows them at the handoff.
export function ConfirmHandoff({ legId }: { legId: string }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      className="mt-1 flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => setError((await confirmHandoffAction(legId, code)).error));
      }}
    >
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Handoff code"
        inputMode="numeric"
        className="h-8 w-28 rounded-full border bg-background px-3 text-sm"
      />
      <Button size="sm" type="submit" loading={pending} disabled={code.length < 6}>Confirm handoff</Button>
      {error && <span className="self-center text-xs text-destructive">{error}</span>}
    </form>
  );
}

// The owner, when a rental comes back. Good shape: PayPal takes the fee and releases the deposit.
export function ConfirmReturn({ legId, deposit }: { legId: string; deposit: number }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <Button size="sm" loading={pending && busy === "ok"} disabled={pending} onClick={() => { setBusy("ok"); start(() => confirmReturnAction(legId, true)); }}>It&apos;s back in good shape</Button>
      <Button size="sm" variant="outline" loading={pending && busy === "keep"} disabled={pending} onClick={() => { setBusy("keep"); start(() => confirmReturnAction(legId, false)); }}>Something&apos;s wrong: keep the ${deposit.toFixed(0)} deposit</Button>
    </div>
  );
}
