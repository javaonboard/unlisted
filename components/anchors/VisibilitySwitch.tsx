"use client";

import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

function Knob({ open }: { open: boolean }) {
  const { pending } = useFormStatus();
  return (
    <>
      <button
        type="submit"
        role="switch"
        aria-checked={open}
        aria-label={open ? "Make private" : "Make public"}
        disabled={pending}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:opacity-60 ${open !== pending ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${open !== pending ? "translate-x-4" : ""}`} />
      </button>
      <span className={open !== pending ? "font-medium text-primary" : "text-muted-foreground"}>{open !== pending ? "Public" : "Private"}</span>
      {pending && <Loader2 className="size-3.5 animate-spin text-muted-foreground" />}
    </>
  );
}

// Private (knob left) or Public (knob right). The knob moves as soon as you click, with a spinner until it's saved.
export function VisibilitySwitch({ action, open }: { action: () => Promise<void>; open: boolean }) {
  return (
    <form action={action} className="flex items-center gap-2 text-xs">
      <Knob open={open} />
    </form>
  );
}
