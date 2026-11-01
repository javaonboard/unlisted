"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { backOutAction } from "@/app/actions/deals";

const REASONS = [
  ["price", "Price"],
  ["time", "Time or place"],
  ["changed_mind", "Changed my mind"],
  ["found_other", "Found another"],
  ["not_as_described", "Not as described"],
  ["no_answer", "No answer from them"],
  ["other", "Other"],
] as const;

// Saying no after the agents agreed. A reason helps the other side and both agents next time.
export function BackOut({ roomId, paid }: { roomId: string; paid: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof REASONS)[number][0] | null>(null);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) return <Button size="xs" variant="ghost" className="text-muted-foreground" onClick={() => setOpen(true)}>Back out</Button>;
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border p-3 text-sm">
      <p className="font-medium">Why are you backing out?</p>
      <div className="flex flex-wrap gap-2">
        {REASONS.map(([value, label]) => (
          <Button key={value} size="xs" variant={reason === value ? "default" : "outline"} onClick={() => setReason(value)}>{label}</Button>
        ))}
      </div>
      {reason === "time" && <p className="text-muted-foreground">You can also use Change time or Change place above and keep the deal.</p>}
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything to add? (optional)" className="h-8 rounded-full border bg-background px-3" />
      <p className="text-xs text-muted-foreground">{paid ? "Your PayPal hold is released, nothing is charged." : "Nothing has been paid, so no money moves."} You two won&apos;t be matched again for this.</p>
      <div className="flex gap-2">
        <Button size="sm" variant="destructive" loading={pending} disabled={!reason} onClick={() => start(async () => setError(await backOutAction(roomId, reason!, note)))}>Back out</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Keep the deal</Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}
