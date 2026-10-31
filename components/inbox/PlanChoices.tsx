"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptPlanAction } from "@/app/actions/suggestions";

type Parts = { sellId: string; sellText: string; buyId: string; buyText: string; serviceId: string; serviceText: string };

// "Change the plan": pick what goes in, and whether the sale waits for the purchase.
export function PlanChoices({ id, parts }: { id: string; parts: Parts }) {
  const [open, setOpen] = useState(false);
  const [sell, setSell] = useState(true);
  const [buy, setBuy] = useState(true);
  const [service, setService] = useState(!!parts.serviceId);
  const [linked, setLinked] = useState(true);
  const [pending, start] = useTransition();

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Change the plan</Button>;

  const tick = (checked: boolean, set: (v: boolean) => void, text: string) => (
    <label className="flex items-center gap-2"><input type="checkbox" checked={checked} onChange={(e) => set(e.target.checked)} className="size-4 accent-primary" /> {text}</label>
  );
  return (
    <div className="mt-2 flex w-full flex-col gap-2 rounded-xl border bg-background p-3 text-sm">
      {tick(sell, setSell, parts.sellText)}
      {tick(buy, setBuy, parts.buyText)}
      {parts.serviceId && tick(service, setService, parts.serviceText)}
      {sell && buy && tick(linked, setLinked, "Only sell if the purchase works out")}
      <div className="flex gap-2">
        <Button
          size="sm"
          disabled={pending || (!sell && !buy)}
          onClick={() =>
            start(() =>
              acceptPlanAction(id, {
                sellId: sell ? parts.sellId : undefined,
                buyId: buy ? parts.buyId : undefined,
                serviceId: service ? parts.serviceId : undefined,
                sellOnlyIfBought: sell && buy && linked,
              }),
            )
          }
        >
          Start this plan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
