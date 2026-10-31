import Link from "next/link";

type Entry = {
  room: { id: string; status: string; agreedPrice: string | null; closedReason: string | null; label: string | null };
  other: string;
  lastPrice: string | null;
};

const status = (e: Entry) =>
  e.room.status === "agreed" ? `Agreed $${Number(e.room.agreedPrice).toFixed(0)}`
  : e.room.status === "waiting_owner" ? "Needs you"
  : e.room.status === "open" ? `… talking${e.lastPrice ? `, last $${Number(e.lastPrice).toFixed(0)}` : ""}`
  : `Closed: ${e.room.closedReason ?? "no deal"}`;

// Every agent that reached out about this item or need. Click to open the chat.
export function NegotiationList({ entries }: { entries: Entry[] }) {
  if (!entries.length) return <p className="text-sm text-muted-foreground">No agents have reached out yet.</p>;
  return (
    <div className="flex flex-col gap-2">
      {entries.map((e) => (
        <Link key={e.room.id} href={`/rooms/${e.room.id}`} className="flex items-center justify-between rounded-xl border p-3 text-sm hover:bg-muted/50">
          <span><span className="font-medium">{e.other}&apos;s agent</span>{e.room.label ? ` · ${e.room.label}` : ""}</span>
          <span className="text-muted-foreground">{status(e)}</span>
        </Link>
      ))}
    </div>
  );
}
