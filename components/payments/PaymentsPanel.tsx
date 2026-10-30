import { Button } from "@/components/ui/button";
import { approveDealAction, cancelHoldAction } from "@/app/actions/payments";
import { PayButton } from "./PayButton";
import { ConfirmHandoff } from "./LegActions";

type Leg = { id: string; description: string; amount: string; payerId: string; payeeId: string; status: string; handoffCode: string | null };
type Room = { status: string };

const statusText: Record<string, string> = {
  pending: "waiting for payment", held: "💳 on hold", captured: "captured", paid_out: "💸 paid out", voided: "released", refunded: "refunded",
};

export function PaymentsPanel(props: {
  dealId: string;
  isOwner: boolean;
  viewerId: string;
  rooms: Room[];
  legs: Leg[];
  names: Record<string, string>;
  clientId: string;
}) {
  const { dealId, isOwner, viewerId, rooms, legs, names, clientId } = props;
  const first = (id: string) => names[id]?.split(" ")[0] ?? id;
  const settled = rooms.length > 0 && rooms.some((r) => r.status === "agreed") && !rooms.some((r) => r.status === "open" || r.status === "waiting_owner");
  const myPending = legs.filter((l) => l.payerId === viewerId && l.status === "pending");
  const myHeld = legs.filter((l) => l.payerId === viewerId && l.status === "held");
  const untouched = myHeld.length > 0 && !legs.some((l) => l.payerId === viewerId && (l.status === "captured" || l.status === "paid_out"));

  return (
    <div className="flex flex-col gap-3">
      {isOwner && legs.length === 0 && (
        settled ? (
          <form action={approveDealAction.bind(null, dealId)}>
            <Button type="submit" className="w-full">Approve plan</Button>
          </form>
        ) : (
          <p className="text-muted-foreground">Approve once the agents are done.</p>
        )
      )}

      {myPending.length > 0 && (
        <PayButton dealId={dealId} clientId={clientId} total={myPending.reduce((s, l) => s + Number(l.amount), 0)} />
      )}

      {legs.map((leg) => (
        <div key={leg.id} className="rounded-xl border p-2">
          <div className="flex justify-between gap-2">
            <span>{leg.description}</span>
            <span className="font-medium">${Number(leg.amount).toFixed(0)}</span>
          </div>
          <p className="text-xs text-muted-foreground">
            {first(leg.payerId)} → {first(leg.payeeId)} · {statusText[leg.status] ?? leg.status}
          </p>
          {leg.status === "held" && leg.payeeId === viewerId && (
            <p className="mt-1 text-xs">Show this at the handoff: <span className="font-mono text-sm font-semibold">{leg.handoffCode}</span></p>
          )}
          {leg.status === "held" && leg.payerId === viewerId && <ConfirmHandoff legId={leg.id} />}
        </div>
      ))}

      {untouched && (
        <form action={cancelHoldAction.bind(null, dealId)}>
          <Button type="submit" variant="outline" size="sm">Cancel and release my hold</Button>
        </form>
      )}
    </div>
  );
}
