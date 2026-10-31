import Link from "next/link";
import { Button } from "@/components/ui/button";
import { approveDealAction, cancelHoldAction } from "@/app/actions/payments";
import { PayButton } from "@/components/payments/PayButton";
import { ConfirmHandoff } from "@/components/payments/LegActions";
import { AcceptDeal } from "@/components/rooms/AcceptDeal";
import { FEE, feeOf, money, payoutOf } from "@/lib/payments/fees";

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
  price: number;
  buyerId: string;
  clientId: string;
};

const done = "text-muted-foreground line-through";

// What happens after the agents agree: accept the deal and time, pay, hand off.
export function NextSteps(p: Props) {
  const leg = p.leg;
  const iPay = leg?.payerId === p.viewerId;
  const iGetPaid = leg?.payeeId === p.viewerId;
  const time = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });

  const held = leg && leg.status !== "pending";
  const handedOff = leg && (leg.status === "captured" || leg.status === "paid_out");
  const closed = handedOff || leg?.status === "voided";

  // Step 1 is one "Accept" for the deal and its time. In a plan, the owner approves the whole plan instead.
  const accepted = !p.waitingOn.includes(p.viewerId);
  const stepOneDone = p.isPlan ? (p.isPlanOwner ? p.hasLegs : accepted) : p.hasLegs && accepted;
  const others = p.waitingOn.filter((id) => id !== p.viewerId).map(p.first).join(" and ");

  return (
    <div className="mt-3 rounded-2xl border p-4 text-sm">
      <p className="mb-3 font-medium">Next steps</p>
      <ol className="flex flex-col gap-3">
        <li>
          <span className={stepOneDone ? done : ""}>1. {p.isPlan && p.isPlanOwner ? "Approve the plan" : p.isPlan || p.hasLegs ? "Accept the time" : "Accept the deal"}</span>
          <p className="mt-1 text-muted-foreground">
            {p.booking ? `${p.booking.startsAt.toLocaleDateString("en-US", { weekday: "short" })} ${time(p.booking.startsAt)}–${time(p.booking.endsAt)}` : (p.when ?? "")}
            {p.place ? ` · ${p.place}` : ""}
            {p.booking && (p.waitingOn.length === 0 ? " · accepted by both" : others ? ` · waiting for ${others}` : "")}
          </p>
          {!closed && p.isPlan && p.isPlanOwner && !p.hasLegs && (
            <div className="mt-2">
              {p.planSettled ? (
                <form action={approveDealAction.bind(null, p.dealId!)}><Button size="sm">Approve plan</Button></form>
              ) : (
                <span className="text-muted-foreground">Waiting for the other parts of the plan</span>
              )}
            </div>
          )}
          {!closed && p.booking && <AcceptDeal roomId={p.roomId} canAccept={!accepted && !(p.isPlan && p.isPlanOwner && !p.hasLegs)} />}
          {p.isPlan && !p.isPlanOwner && accepted && !p.hasLegs && <p className="mt-1 text-muted-foreground">Waiting for the plan owner to approve</p>}
        </li>

        <li className={held ? done : ""}>
          2. Hold the payment with PayPal
          {/* Who pays what, so nobody is surprised by the fee. */}
          <p className="mt-1 text-muted-foreground">
            {p.buyerId === p.viewerId
              ? `You pay ${money(p.price)}. Nothing is charged until the handoff.`
              : `${p.first(p.buyerId)} pays ${money(p.price)} · Unlisted fee ${FEE * 100}% (${money(feeOf(p.price))}) · you get ${money(payoutOf(p.price))}`}
          </p>
          {stepOneDone && leg?.status === "pending" && (
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
