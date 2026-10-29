import { Badge } from "@/components/ui/badge";

type Move = {
  id: string;
  round: number;
  fromUserId: string;
  kind: string;
  price: string | null;
  terms: Record<string, unknown>;
  note: string | null;
  reasoning: string | null;
  signalsUsed: string[];
  a2a: Record<string, unknown> | null;
};

export function Transcript({ moves, viewerId, names }: { moves: Move[]; viewerId: string; names: Record<string, string> }) {
  if (moves.length === 0) return <p className="text-sm text-muted-foreground">Agents are getting ready…</p>;

  return (
    <ol className="flex flex-col gap-3">
      {moves.map((m) => {
        const mine = m.fromUserId === viewerId;
        const pickup = (m.terms as { pickup?: string }).pickup;
        return (
          <li key={m.id} className={`max-w-[85%] rounded-2xl border p-3 ${mine ? "self-end bg-accent" : "self-start bg-card"}`}>
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{names[m.fromUserId]}&apos;s agent</span>
              <Badge variant="outline">{m.kind.replace("_", " ")}</Badge>
              {m.price && <span className="font-medium text-foreground">${Number(m.price).toFixed(0)}</span>}
              {pickup && <span>· {pickup}</span>}
              <span className="ml-auto">round {m.round}</span>
            </div>
            <p className="text-sm">{m.note}</p>

            {mine && m.reasoning && (
              <p className="mt-2 rounded-lg bg-background/60 p-2 text-xs text-muted-foreground">
                <span className="font-medium">Only you see this:</span> {m.reasoning}
                {m.signalsUsed.length > 0 && <span className="block mt-1">Signals: {m.signalsUsed.join(" · ")}</span>}
              </p>
            )}

            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground">Show A2A message</summary>
              <pre className="mt-1 overflow-x-auto rounded-lg bg-muted p-2">{JSON.stringify(m.a2a, null, 2)}</pre>
            </details>
          </li>
        );
      })}
    </ol>
  );
}
