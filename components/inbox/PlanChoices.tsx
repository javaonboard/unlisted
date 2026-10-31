"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptPlanAction, replanAction } from "@/app/actions/suggestions";

type Part = { kind: "sell" | "buy" | "helper"; id: string; text: string };
const VERB = { sell: "Sell", buy: "Buy", helper: "Book" };

// "Change the plan": pick what goes in, and whether the sales wait for the purchases.
export function PlanChoices({ id, parts, linked: linkedByAgent }: { id: string; parts: Part[]; linked: boolean }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(parts.map((p) => p.id));
  const [linked, setLinked] = useState(linkedByAgent);
  const [words, setWords] = useState("");
  const [pending, start] = useTransition();

  if (!open) return <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Change the plan</Button>;

  const has = (kind: Part["kind"]) => parts.some((p) => p.kind === kind && picked.includes(p.id));
  const toggle = (partId: string) => setPicked(picked.includes(partId) ? picked.filter((x) => x !== partId) : [...picked, partId]);
  return (
    <div className="mt-2 flex w-full flex-col gap-2 rounded-xl border bg-background p-3 text-sm">
      {parts.map((p) => (
        <label key={p.id} className="flex items-center gap-2">
          <input type="checkbox" checked={picked.includes(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-primary" />
          <span><span className="font-medium">{VERB[p.kind]}:</span> {p.text}</span>
        </label>
      ))}
      {has("sell") && has("buy") && (
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={linked} onChange={(e) => setLinked(e.target.checked)} className="size-4 accent-primary" />
          Only sell once the purchase works out
        </label>
      )}
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (words.trim()) start(() => replanAction(id, words)); }}>
        <input
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="Or tell your agent, e.g. “keep the sale separate and add a cleaner”"
          className="h-8 flex-1 rounded-full border bg-background px-3"
          disabled={pending}
        />
        <Button size="sm" type="submit" variant="secondary" disabled={pending || !words.trim()}>{pending ? "Re-planning…" : "Ask"}</Button>
      </form>
      <div className="flex gap-2">
        <Button size="sm" disabled={pending || (!has("sell") && !has("buy"))} onClick={() => start(() => acceptPlanAction(id, { partIds: picked, sellOnlyIfBought: has("sell") && has("buy") && linked }))}>
          Start this plan
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}
