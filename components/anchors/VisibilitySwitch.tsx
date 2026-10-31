// Private (knob left) or Public (knob right). One click flips it; going public starts talks with the best matches.
export function VisibilitySwitch({ action, open }: { action: () => Promise<void>; open: boolean }) {
  return (
    <form action={action} className="flex items-center gap-2 text-xs">
      <button
        type="submit"
        role="switch"
        aria-checked={open}
        aria-label={open ? "Make private" : "Make public"}
        className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${open ? "bg-primary" : "bg-muted-foreground/30"}`}
      >
        <span className={`absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform ${open ? "translate-x-4" : ""}`} />
      </button>
      <span className={open ? "font-medium text-primary" : "text-muted-foreground"}>{open ? "Public" : "Private"}</span>
    </form>
  );
}
