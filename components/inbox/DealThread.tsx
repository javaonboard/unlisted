import { RoleBadge, StatusPill } from "@/components/anchors/Badges";
import { RoomActions } from "@/components/inbox/RoomActions";
import { FormattedText } from "@/components/FormattedText";
import { Thumb } from "@/components/anchors/Thumb";
import type { Next, Role } from "@/lib/anchors/next";

type Note = { id: string; title: string; body: string; createdAt: Date };
const time = (d: Date) => d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });

// One deal in the inbox: what it is, where it stands, what you can do now, and its history folded away.
export function DealThread(p: { roomId: string; item: { kind: string; photos: string[] }; viewerId: string; role: Role; next: Next; distance: string; plan: string | null; notes: Note[]; open: boolean }) {
  const latest = p.notes[0];
  const history = [...p.notes].reverse();
  return (
    <div id={`room-${p.roomId}`} className={`scroll-mt-24 rounded-2xl border px-4 py-3 text-sm ${p.next.state === "needs_you" ? "border-primary/50 ring-1 ring-primary/20" : ""}`}>
      <div className="flex items-center gap-3">
        <Thumb item={p.item} size="size-11" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{p.role.title}</p>
            {p.notes.length > 1 && <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{p.notes.length} updates</span>}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
            <RoleBadge role={p.role} />
            <StatusPill next={p.next} />
            <span className="text-muted-foreground">{p.distance}{p.plan ? ` · part of your ${p.plan} plan` : ""}</span>
          </div>
        </div>
      </div>
      {latest && <p className="mt-2 text-muted-foreground"><span className="text-foreground">{latest.title}.</span> {latest.body}</p>}

      {p.open ? (
        <RoomActions roomId={p.roomId} viewerId={p.viewerId} header={false} />
      ) : (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-primary">Open</summary>
          <RoomActions roomId={p.roomId} viewerId={p.viewerId} header={false} />
        </details>
      )}

      {history.length > 1 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-xs text-muted-foreground">See what happened ({history.length})</summary>
          <ol className="mt-2 flex flex-col gap-1.5 border-l pl-3">
            {history.map((n) => (
              <li key={n.id}>
                <span className="font-medium">{n.title}</span> <span className="text-xs text-muted-foreground">· {time(n.createdAt)}</span>
                <FormattedText text={n.body} className="text-muted-foreground" />
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}
