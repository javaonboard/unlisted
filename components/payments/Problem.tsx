"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { answerProblemAction, reportProblemAction } from "@/app/actions/deals";

type Problem = { note: string; refund: number; status: "open" | "refunded" | "declined" } | null;

// After the handoff: the buyer reports what's wrong and asks for a refund; the seller agrees or declines.
export function Problem({ legId, problem, iPay, charged, other }: { legId: string; problem: Problem; iPay: boolean; charged: number; other: string }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [refund, setRefund] = useState(String(charged));
  const [busy, setBusy] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (problem) {
    const ask = `“${problem.note}”, refund $${problem.refund.toFixed(2)}`;
    if (problem.status === "refunded") return <p className="mt-1">Refunded ${problem.refund.toFixed(2)} through PayPal.</p>;
    if (problem.status === "declined") return <p className="mt-1">{iPay ? `${other} declined the refund. You can still open a case with PayPal.` : "You declined the refund request."}</p>;
    if (iPay) return <p className="mt-1 text-muted-foreground">You reported a problem ({ask}). Waiting for {other}.</p>;
    return (
      <div className="mt-1">
        <p>{other} reported a problem: {ask}.</p>
        <div className="mt-2 flex gap-2">
          <Button size="sm" loading={pending && busy === "yes"} disabled={pending} onClick={() => { setBusy("yes"); start(() => answerProblemAction(legId, true)); }}>Refund ${problem.refund.toFixed(2)}</Button>
          <Button size="sm" variant="outline" loading={pending && busy === "no"} disabled={pending} onClick={() => { setBusy("no"); start(() => answerProblemAction(legId, false)); }}>Decline</Button>
        </div>
      </div>
    );
  }
  if (!iPay) return null;
  if (!open) return <Button size="xs" variant="ghost" className="mt-1 text-muted-foreground" onClick={() => setOpen(true)}>Report a problem</Button>;
  return (
    <div className="mt-2 flex flex-col gap-2 rounded-xl border p-3 text-sm">
      <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="What's wrong?" className="h-8 rounded-full border bg-background px-3" />
      <label className="flex items-center gap-2">Refund ${" "}<input value={refund} onChange={(e) => setRefund(e.target.value)} type="number" min={1} max={charged} className="h-8 w-24 rounded-full border bg-background px-3" /> of ${charged.toFixed(2)}</label>
      <div className="flex gap-2">
        <Button size="sm" loading={pending} disabled={!note.trim()} onClick={() => start(async () => setError(await reportProblemAction(legId, note, Number(refund))))}>Send to {other}</Button>
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
      </div>
      {error && <p className="text-destructive">{error}</p>}
    </div>
  );
}
