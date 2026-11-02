"use client";

import { useOptimistic, useTransition } from "react";
import { Loader2 } from "lucide-react";
import type { Ways } from "@/lib/vault/ways";

const LABEL: Record<Ways, string> = { sell: "Sell", rent: "Rent", both: "Both" };

// Sell it, rent it out, or both. The choice shows at once, with a spinner until it's saved.
export function WaysSwitch({ ways, onChange }: { ways: Ways; onChange: (next: Ways) => void | Promise<unknown> }) {
  const [shown, setShown] = useOptimistic(ways);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-1 text-xs">
      {(Object.keys(LABEL) as Ways[]).map((w) => (
        <button
          key={w}
          type="button"
          disabled={pending}
          aria-pressed={shown === w}
          onClick={() => start(async () => { setShown(w); await onChange(w); })}
          className={`rounded-full px-2.5 py-0.5 ${shown === w ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
        >
          {LABEL[w]}
        </button>
      ))}
      {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </div>
  );
}
