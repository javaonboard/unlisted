"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Props = {
  label: string; // the button that opens it
  title: string; // a short question
  points: string[]; // what happens if they say yes, in 1-3 short lines
  confirm: string; // the yes button
  action: () => Promise<unknown>;
  variant?: "default" | "outline" | "destructive" | "secondary";
  size?: "sm" | "default";
};

// For steps that can't be undone: say plainly what will happen, then Yes or Not yet.
export function ConfirmAction({ label, title, points, confirm, action, variant = "default", size = "sm" }: Props) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  return (
    <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
      <DialogTrigger render={<Button size={size} variant={variant} />}>{label}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription render={<ul className="list-disc space-y-1 pl-5" />}>
            {points.map((p) => <li key={p}>{p}</li>)}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>Not yet</Button>
          <Button variant={variant === "destructive" ? "destructive" : "default"} loading={pending} onClick={() => start(async () => { await action(); setOpen(false); })}>{confirm}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
