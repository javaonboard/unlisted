"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { confirmHandoffAction } from "@/app/actions/payments";

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
      <Button size="sm" type="submit" disabled={pending || code.length < 6}>Got it</Button>
      {error && <span className="self-center text-xs text-destructive">{error}</span>}
    </form>
  );
}
