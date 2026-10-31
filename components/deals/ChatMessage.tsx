import Link from "next/link";
import { Clock, DollarSign, MapPin, Receipt } from "lucide-react";
import { OwnerQuestion } from "./OwnerQuestion";

type Message = {
  id: string;
  negotiationId: string;
  fromUserId: string;
  kind: string;
  price: string | null;
  terms: Record<string, unknown>;
  note: string | null;
  reasoning: string | null;
  a2a: Record<string, unknown> | null;
  createdAt: Date;
};

const chip = "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5";

const label: Record<string, string> = {
  offer: "offer", counter: "counter", question: "question", accept: "accepted",
  reject: "declined", walk_away: "walked away", ask_owner: "asks you", owner_note: "you replied",
};

export function ChatMessage({ m, viewerId, name, thread, waiting }: { m: Message; viewerId: string; name: string; thread: string; waiting: boolean }) {
  const t = m.terms as { when?: string; place?: string; costs?: string };
  const fromOwner = m.kind === "owner_note";
  const asksMe = m.kind === "ask_owner";
  const time = m.createdAt.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  return (
    <div className={`flex gap-3 rounded-xl px-2 py-1.5 ${asksMe ? "bg-accent" : "hover:bg-muted/40"}`}>
      <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold text-primary">
        {name[0]}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-2 text-xs text-muted-foreground">
          <span className="text-sm font-semibold text-foreground">{fromOwner ? "You" : `${name}'s agent`}</span>
          <span>{time}</span>
          {thread && <Link href={`/rooms/${m.negotiationId}`} className="rounded-full border px-2 hover:bg-muted">{thread}</Link>}
          <span>{label[m.kind] ?? m.kind}</span>
        </div>
        <p className="text-sm">{m.note}</p>
        <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
          {m.price && !fromOwner && <span className={chip}><DollarSign className="size-3" />{Number(m.price).toFixed(0)}</span>}
          {t.when && <span className={chip}><Clock className="size-3" />{t.when}</span>}
          {t.place && <span className={chip}><MapPin className="size-3" />{t.place}</span>}
          {t.costs && <span className={chip}><Receipt className="size-3" />{t.costs}</span>}
        </div>
        {asksMe && waiting && <OwnerQuestion roomId={m.negotiationId} suggestedPrice={m.price ? Number(m.price) : null} />}
        {(m.reasoning && m.fromUserId === viewerId && !asksMe) || m.a2a ? (
          <details className="mt-1 text-xs text-muted-foreground">
            <summary className="cursor-pointer">details</summary>
            {m.reasoning && m.fromUserId === viewerId && <p className="mt-1">Why (only you see this): {m.reasoning}</p>}
            {m.a2a && <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2">{JSON.stringify(m.a2a, null, 2)}</pre>}
          </details>
        ) : null}
      </div>
    </div>
  );
}
