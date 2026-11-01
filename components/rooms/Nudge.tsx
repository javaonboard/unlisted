"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { nudgeAction } from "@/app/actions/deals";

// Poke the other side about what the deal is waiting on. At most once every 30 minutes.
export function Nudge({ roomId }: { roomId: string }) {
  const [note, setNote] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex items-center gap-2">
      <Button size="xs" variant="outline" loading={pending} onClick={() => start(async () => setNote(await nudgeAction(roomId)))}>Nudge</Button>
      {note && <span className="text-xs text-muted-foreground">{note}</span>}
    </span>
  );
}
