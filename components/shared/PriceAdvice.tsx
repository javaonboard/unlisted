"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import type { PriceCheck } from "@/lib/pricing/check";

// The agent's price advice with where it came from. "Use it" fills the owner's price; they can still change it.
export function PriceAdvice({ check, onCheck, onUse, useLabel }: { check: PriceCheck | null; onCheck: () => Promise<void>; onUse?: () => Promise<void>; useLabel: string }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  return (
    <div className="mt-3 rounded-xl bg-secondary p-3 text-sm">
      {check ? (
        <>
          <p>
            <span className="font-medium">Price check: about ${check.suggested.toFixed(0)}</span>
            <span className="text-muted-foreground"> · used ${check.usedLow.toFixed(0)}–${check.usedHigh.toFixed(0)}{check.newPrice ? ` · new ~$${check.newPrice.toFixed(0)}` : ""}</span>
          </p>
          <p className="mt-1 text-muted-foreground">{check.note}</p>
          {check.sources.length > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              Sources: {check.sources.map((s, i) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">{i > 0 ? ", " : ""}{s.title}</a>)}
            </p>
          )}
        </>
      ) : (
        <p className="text-muted-foreground">No price check yet.</p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        {check && onUse && <Button size="sm" variant="secondary" loading={pending && busy === "use"} disabled={pending} onClick={() => { setBusy("use"); start(onUse); }}>{useLabel} ${check.suggested.toFixed(0)}</Button>}
        <Button size="sm" variant="outline" loading={pending && busy === "check"} disabled={pending} onClick={() => { setBusy("check"); start(onCheck); }}>{pending && busy === "check" ? "Checking the web…" : check ? "Check again" : "Check the price"}</Button>
      </div>
    </div>
  );
}
