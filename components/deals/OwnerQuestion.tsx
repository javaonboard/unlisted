"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { replyToAgent } from "@/app/actions/deals";

// The agent asked its owner something. Quick answers, or say it in your own words.
export function OwnerQuestion({ roomId, suggestedPrice }: { roomId: string; suggestedPrice: number | null }) {
  const [words, setWords] = useState("");
  const [pending, start] = useTransition();
  const send = (text: string) => text.trim() && start(() => replyToAgent(roomId, text));

  return (
    <div className="mt-2 flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" disabled={pending} onClick={() => send(suggestedPrice ? `Yes, $${suggestedPrice} is fine.` : "Yes, go ahead.")}>Yes</Button>
        <Button size="sm" variant="outline" disabled={pending} onClick={() => send("No, keep my original limit.")}>No</Button>
      </div>
      <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); send(words); }}>
        <input
          value={words}
          onChange={(e) => setWords(e.target.value)}
          placeholder="Or reply in your words, e.g. “let's see if they'd do $200”"
          className="h-8 flex-1 rounded-full border bg-background px-3 text-sm"
          disabled={pending}
        />
        <Button size="sm" type="submit" variant="secondary" disabled={pending || !words.trim()}>Send</Button>
      </form>
    </div>
  );
}
