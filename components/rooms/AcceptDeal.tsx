"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptDealAction, changeMeetAtAction, changeTimeAction } from "@/app/actions/deals";
import type { MeetAt } from "@/lib/deals/meet";

type Place = { meetAt: MeetAt; isSeller: boolean; other: string; allowed: MeetAt[] };

// Approve the deal the agents agreed, with its time and place, or change either one.
export function AcceptDeal({ roomId, canAccept, place }: { roomId: string; canAccept: boolean; place: Place }) {
  const [words, setWords] = useState("");
  const [asking, setAsking] = useState(false);
  const [moving, setMoving] = useState(false);
  const mine: MeetAt = place.isSeller ? "seller_home" : "buyer_home";
  const theirs: MeetAt = place.isSeller ? "buyer_home" : "seller_home";
  const options: [MeetAt, string][] = [[mine, "My place"], [theirs, `${place.other}'s place`], ["public", "A public spot"]];
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState("");
  const run = (key: string, action: () => Promise<unknown>) => { setBusy(key); start(async () => { await action(); }); };

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canAccept && <Button size="sm" loading={pending && busy === "approve"} disabled={pending} onClick={() => run("approve", () => acceptDealAction(roomId))}>Approve</Button>}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setAsking(!asking)}>Change time</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setMoving(!moving)}>Change place</Button>
      </div>
      {moving && (
        <div className="flex flex-wrap gap-2">
          {options.map(([value, text]) => (
            <Button key={value} size="sm" variant={value === place.meetAt ? "default" : "secondary"} disabled={pending || value === place.meetAt || !place.allowed.includes(value)}
              title={place.allowed.includes(value) ? undefined : "Too far for how far one of you will travel"}
              loading={pending && busy === value} onClick={() => run(value, async () => { await changeMeetAtAction(roomId, value); setMoving(false); })}>
              {text}
            </Button>
          ))}
        </div>
      )}
      {asking && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (words.trim()) run("time", () => changeTimeAction(roomId, words)); }}>
          <input
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="e.g. “Sunday after 2pm works better”"
            className="h-8 flex-1 rounded-full border bg-background px-3 text-sm"
            disabled={pending}
          />
          <Button size="sm" type="submit" variant="secondary" loading={pending && busy === "time"} disabled={pending || !words.trim()}>Send</Button>
        </form>
      )}
    </div>
  );
}
