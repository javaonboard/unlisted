"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { acceptDealAction, changeTimeAction } from "@/app/actions/deals";

// Accept the deal and its time, or ask for another time in your own words.
export function AcceptDeal({ roomId, canAccept }: { roomId: string; canAccept: boolean }) {
  const [words, setWords] = useState("");
  const [asking, setAsking] = useState(false);
  const [pending, start] = useTransition();

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        {canAccept && <Button size="sm" disabled={pending} onClick={() => start(() => acceptDealAction(roomId))}>Accept</Button>}
        <Button size="sm" variant="outline" disabled={pending} onClick={() => setAsking(!asking)}>Change time</Button>
      </div>
      {asking && (
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (words.trim()) start(() => changeTimeAction(roomId, words)); }}>
          <input
            value={words}
            onChange={(e) => setWords(e.target.value)}
            placeholder="e.g. “Sunday after 2pm works better”"
            className="h-8 flex-1 rounded-full border bg-background px-3 text-sm"
            disabled={pending}
          />
          <Button size="sm" type="submit" variant="secondary" disabled={pending || !words.trim()}>Send</Button>
        </form>
      )}
    </div>
  );
}
