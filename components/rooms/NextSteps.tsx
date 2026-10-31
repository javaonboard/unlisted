import Link from "next/link";
import { Button } from "@/components/ui/button";
import { approveDealAction, cancelHoldAction, confirmSoloDealAction } from "@/app/actions/payments";
import { PayButton } from "@/components/payments/PayButton";
import { ConfirmHandoff } from "@/components/payments/LegActions";
import { TimeConfirm } from "@/components/rooms/TimeConfirm";

type Props = {
  roomId: string;
  dealId: string | null;
  isPlan: boolean;
  isPlanOwner: boolean;
  planSettled: boolean;
  hasLegs: boolean;
  viewerId: string;
  first: (id: string) => string;
  leg: { id: string; payerId: string; payeeId: string; amount: string; status: string; handoffCode: string | null } | null;
  payTotal: number;
  when: string | null;
  place: string | null;
  booking: { startsAt: Date; endsAt: Date } | null;
  waitingOn: string[];
  buyerId: string;
  clientId: string;
};

const done = "text-muted-foreground line-through";

// What happens after the agents agree: schedule, approve, pay, hand off.
export function NextSteps(p: Props) {
  const leg = p.leg;
  const iPay = leg?.payerId === p.viewerId;
  const iGetPaid = leg?.payeeId === p.viewerId;
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const approved = p.hasLegs;
  const held = leg && leg.status !== "pending";
  const handedOff = leg && (leg.status === "captured" || leg.status === "paid_out");

  // The buyer says yes to the time by placing the hold; after that, like anyone else.
  const final = p.booking && p.waitingOn.length === 0;
  const waiting = p.waitingOn.map((id) => (id === p.viewerId ? "you" : p.first(id))).join(" and ");
  const canConfirm = p.waitingOn.includes(p.viewerId) && (p.buyerId !== p.viewerId || !!held);

  return (
    <div className="mt-3 rounded-2xl border p-4 text-sm">
      <p className="mb-3 font-medium">Next steps</p>
      <p className="mb-3 text-muted-foreground">
        {p.booking ? `${p.booking.startsAt.toLocaleDateString("en-US", { weekday: "short" })} ${time(p.booking.startsAt)}–${time(p.booking.endsAt)}` : p.when ? p.when : ""}
        {p.place ? ` · ${p.place}` : ""}
        {p.booking && (final ? " · Time confirmed by both" : ` · Tentative, waiting for ${waiting}`)}
      </p>
      {p.booking && !handedOff && leg?.status !== "voided" && <div className="-mt-2 mb-3"><TimeConfirm roomId={p.roomId} canConfirm={canConfirm} /></div>}

      <ol className="flex flex-col gap-3">
        <li className={approved ? done : ""}>
          1. {p.isPlan ? "Approve the plan" : "Confirm the deal"}
          {!approved && (
            <div className="mt-1">
              {!p.isPlan ? (
                <form action={confirmSoloDealAction.bind(null, p.roomId)}><Button size="sm">Confirm deal</Button></form>
              ) : !p.planSettled ? (
                <span className="text-muted-foreground"> · waiting for the other parts of the plan</span>
              ) : p.isPlanOwner ? (
                <form action={approveDealAction.bind(null, p.dealId!)}><Button size="sm">Approve plan</Button></form>
              ) : (
                <span className="text-muted-foreground"> · waiting for the plan owner</span>
              )}
            </div>
          )}
        </li>

        <li className={held ? done : ""}>
          2. Hold the payment with PayPal{iPay && !held ? " (this also confirms your time)" : ""}
          {approved && leg?.status === "pending" && (
            <div className="mt-2">
              {iPay ? <PayButton dealId={p.dealId!} clientId={p.clientId} total={p.payTotal} /> : <span className="text-muted-foreground"> · waiting for {p.first(leg.payerId)}</span>}
            </div>
          )}
        </li>

        <li className={handedOff ? done : ""}>
          3. Hand off, then PayPal pays out
          {leg?.status === "held" && iGetPaid && <p className="mt-1">Show this code at the handoff: <span className="font-mono text-base font-semibold">{leg.handoffCode}</span></p>}
          {leg?.status === "held" && iPay && <ConfirmHandoff legId={leg.id} />}
          {leg?.status === "held" && iPay && (
            <form action={cancelHoldAction.bind(null, p.dealId!)} className="mt-1">
              <Button size="sm" variant="ghost">Cancel and release the hold</Button>
            </form>
          )}
          {leg?.status === "paid_out" && <p className="mt-1 text-foreground">Done. {p.first(leg.payeeId)} has been paid.</p>}
          {leg?.status === "voided" && <p className="mt-1 text-foreground">Hold released. Nothing was charged.</p>}
        </li>
      </ol>

      {p.isPlan && p.dealId && (
        <Link href={`/deals/${p.dealId}`} className="mt-3 inline-block text-xs text-muted-foreground hover:text-foreground">See the whole plan</Link>
      )}
    </div>
  );
}
