import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { PayButton } from "@/components/payments/PayButton";
import { ConfirmAction } from "@/components/ConfirmAction";
import { confirmHandoffAction, confirmReturnAction } from "@/app/actions/payments";
import { AcceptDeal } from "@/components/rooms/AcceptDeal";
import { Nudge } from "@/components/rooms/Nudge";
import { BackOut } from "@/components/rooms/BackOut";
import { Problem } from "@/components/payments/Problem";
import { FEE, feeOf, money, payoutOf } from "@/lib/payments/fees";
import { mapsLink } from "@/lib/places";
import type { MeetAt } from "@/lib/deals/meet";
import { AFTER_HANDOFF, PAID } from "@/lib/payments/states";

type Props = {
  roomId: string;
  dealId: string | null;
  isPlan: boolean;
  viewerId: string;
  buyerId: string;
  sellerId: string;
  first: (id: string) => string;
  leg: { id: string; kind: string; payerId: string; payeeId: string; amount: string; deposit: string | null; status: string; handoffCode: string | null; charged: string | null; problem: { note: string; refund: number; status: "open" | "refunded" | "declined" } | null; confirmed: Partial<Record<string, { eventId: string; at: string }>> } | null;
  price: number;
  deposit: number;
  booking: { startsAt: Date; endsAt: Date } | null;
  waitingOn: string[];
  meet: { meetAt: MeetAt; label: string; address: string | null } | null;
  places: MeetAt[];
  stops: string[];
  rentalDays: number | null;
  blockedBy: string | null;
  overLimit: string | null;
  clientId: string;
};

type State = "done" | "now" | "later";

// A small mark that PayPal's own signed webhook confirmed this step.
const Confirmed = ({ what = "" }: { what?: string }) => (
  <span className="inline-flex items-center gap-1 text-xs text-emerald-700"><Check className="size-3" />{what ? `${what} confirmed` : "Confirmed"} by PayPal</span>
);

// One step of the deal: a check when done, a filled dot when it's the current one.
function Step({ n, title, state, children }: { n: number; title: string; state: State; children?: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${state === "done" ? "bg-primary text-primary-foreground" : state === "now" ? "border-2 border-primary text-primary" : "border text-muted-foreground"}`}>
        {state === "done" ? <Check className="size-3" /> : n}
      </span>
      <div className="min-w-0 flex-1">
        <p className={state === "later" ? "text-muted-foreground" : "font-medium"}>{title}</p>
        {children}
      </div>
    </li>
  );
}

// After the agents agree: accept, pay with PayPal (held until the handoff), hand off, paid out.
export function NextSteps(p: Props) {
  const leg = p.leg;
  const iPay = p.buyerId === p.viewerId;
  const rental = !!p.rentalDays;
  const time = (d: Date) => d.toLocaleString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" });
  const status = leg?.status ?? "pending";

  const accepted = p.waitingOn.length === 0 && !!leg;
  const paid = PAID.includes(status);
  const handedOff = AFTER_HANDOFF.includes(status) || (rental && status === "in_use");
  const paidOut = status === "paid_out";
  const ok = (stage: "hold" | "capture" | "payout") => !!leg?.confirmed?.[stage]; // PayPal's signed webhook arrived
  const cancelled = status === "voided";
  const otherId = iPay ? p.sellerId : p.buyerId;
  const other = p.first(otherId);
  const iApproved = !p.waitingOn.includes(p.viewerId);
  const theyApproved = !p.waitingOn.includes(otherId);
  const stateOf = (done: boolean, ready: boolean): State => (done ? "done" : ready ? "now" : "later");

  return (
    <div className="mt-3 rounded-2xl border p-4 text-sm">
      <ol className="flex flex-col gap-3">
        <Step n={1} title={`Agents agreed on ${money(p.price)}`} state="done">
          <p className="text-muted-foreground">
            {p.booking ? `${time(p.booking.startsAt)}${rental ? ` to ${time(p.booking.endsAt)}` : ""}` : ""}
            {p.meet ? ` · ${p.meet.label}` : ""}
          </p>
          {p.stops.length > 0 && <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">{p.stops.map((s) => <li key={s}>{s}</li>)}</ol>}
          {p.blockedBy && <p className="mt-1 text-amber-700">Part of a plan: waiting for {p.blockedBy}.</p>}
          {p.overLimit && <p className="mt-1 text-amber-700">Your agent went a little past your limit: {p.overLimit}</p>}
        </Step>

        <Step n={2} title={accepted ? "Approved by both" : iApproved ? "You approved" : "Approve the deal, time and place"} state={stateOf(accepted, !p.blockedBy)}>
          {!p.blockedBy && !cancelled && (
            <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
              {other}: {theyApproved ? "approved" : "hasn't approved yet"}
              {iApproved && !theyApproved && <Nudge roomId={p.roomId} />}
            </p>
          )}
          {!handedOff && !cancelled && p.booking && p.meet && !p.blockedBy && (
            <AcceptDeal
              roomId={p.roomId}
              canAccept={!iApproved}
              place={{ meetAt: p.meet.meetAt, isSeller: p.sellerId === p.viewerId, other: p.first(iPay ? p.sellerId : p.buyerId), allowed: p.places }}
            />
          )}
        </Step>

        <Step n={3} title={paid ? "Paid, PayPal is holding it" : status === "capture_failed" ? "PayPal declined the payment" : rental ? "Pay the fee and deposit with PayPal" : "Pay with PayPal"} state={stateOf(paid, accepted && !cancelled)}>
          {paid && ok("hold") && <p><Confirmed /></p>}
          <p className="text-muted-foreground">
            {iPay
              ? `You pay ${money(p.price)}${p.deposit ? ` plus a ${money(p.deposit)} deposit you get back` : ""}. PayPal only charges after the ${rental ? "return" : "handoff"}.`
              : `${p.first(p.buyerId)} pays ${money(p.price)} · Unlisted fee ${FEE * 100}% (${money(feeOf(p.price))}) · you get ${money(payoutOf(p.price))}`}
          </p>
          {accepted && leg && status === "pending" && iPay && (
            <div className="mt-2"><PayButton legId={leg.id} clientId={p.clientId} total={Number(leg.amount)} deposit={Number(leg.deposit ?? 0)} /></div>
          )}
          {accepted && !iPay && !cancelled && (
            <p className="mt-1 flex flex-wrap items-center gap-2 text-muted-foreground">
              {other}: {paid ? "paid, PayPal is holding it" : "hasn't paid yet"}
              {!paid && <Nudge roomId={p.roomId} />}
            </p>
          )}
          {cancelled && <p className="mt-1">Hold released. Nothing was charged.</p>}
        </Step>

        <Step n={4} title={rental ? (status === "in_use" ? "Picked up, out on rent" : handedOff ? "Returned" : "Pickup") : handedOff ? "Handed off" : "Hand off"} state={stateOf(handedOff && status !== "in_use", paid && !cancelled)}>
          {paid && p.meet?.address && !paidOut && (
            <p className="flex flex-wrap items-center gap-1">
              <MapPin className="size-4 text-primary" /> {p.meet.label} · {p.meet.address} ·{" "}
              <a href={mapsLink(p.meet.address)} target="_blank" rel="noreferrer" className="text-primary hover:underline">Open in Maps</a>
            </p>
          )}
          {!paid && !cancelled && <p className="text-muted-foreground">The exact address shows here once it&apos;s paid.</p>}
          {handedOff && status !== "in_use" && ok("capture") && <p><Confirmed what="Charge" /></p>}
          {status === "held" && !iPay && <p className="mt-1 text-muted-foreground">{other} confirms {rental ? "the pickup" : "once they have it"}. Then PayPal pays you.</p>}
          {status === "held" && iPay && leg && (
            <div className="mt-2">
              <ConfirmAction
                label={rental ? "I picked it up" : "I have it"}
                title={rental ? "Picked it up?" : "Got it, and it's as described?"}
                points={rental
                  ? [`PayPal keeps holding ${money(p.price)} + the ${money(p.deposit)} deposit while you have it.`, "Bring it back on time to get the deposit back."]
                  : [`PayPal charges the ${money(p.price)} it's holding and pays ${other}.`, "This can't be undone. If something turns out wrong, use Report a problem."]}
                confirm={rental ? "Yes, picked up" : "Yes, I have it"}
                action={confirmHandoffAction.bind(null, leg.id)}
              />
            </div>
          )}
          {status === "in_use" && !iPay && leg && (
            <div className="mt-2 flex flex-wrap gap-2">
              <ConfirmAction
                label="It's back, all good"
                title="Back in good shape?"
                points={[`PayPal charges ${other} the ${money(p.price)} fee and pays you.`, `${other}'s ${money(p.deposit)} deposit is released.`]}
                confirm="Yes, all good"
                action={confirmReturnAction.bind(null, leg.id, true)}
              />
              <ConfirmAction
                label="Something's wrong"
                variant="outline"
                title="Keep the deposit?"
                points={[`PayPal charges ${other} the fee plus the ${money(p.deposit)} deposit.`, "Only if it came back damaged or late. Tell them why in the chat."]}
                confirm="Keep the deposit"
                action={confirmReturnAction.bind(null, leg.id, false)}
              />
            </div>
          )}
          {status === "in_use" && iPay && <p className="mt-1">Bring it back by {p.booking ? time(p.booking.endsAt) : "the end date"}; then the deposit is released.</p>}
        </Step>

        <Step n={5} title={paidOut ? `Paid out to ${p.first(p.sellerId)}` : status === "payout_sent" ? "Payout sent, waiting for PayPal" : status === "payout_failed" ? "Payout didn't go through" : "PayPal pays out"} state={stateOf(paidOut, ["captured", "payout_sent", "payout_failed"].includes(status))}>
          {paidOut && <p className="text-muted-foreground">{p.sellerId === p.viewerId ? `${money(payoutOf(p.price))} is in your PayPal.` : "All done."} <Confirmed /></p>}
          {status === "payout_failed" && p.sellerId === p.viewerId && <p className="text-amber-700">PayPal couldn&apos;t deliver it. Check that your PayPal email is right; Unlisted still holds the money for you.</p>}
          {leg && AFTER_HANDOFF.includes(status) && (
            <Problem legId={leg.id} problem={leg.problem} iPay={iPay} charged={Number(leg.charged ?? leg.amount)} other={other} />
          )}
        </Step>
      </ol>

      {!handedOff && !cancelled && status !== "in_use" && <div className="mt-2"><BackOut roomId={p.roomId} paid={paid} /></div>}
      <div className="mt-3 flex gap-4 text-xs">
        {leg && <Link href={`/money/${leg.id}`} className="text-primary hover:underline">Receipt</Link>}
        {p.isPlan && p.dealId && <Link href={`/deals/${p.dealId}`} className="text-muted-foreground hover:text-foreground">See the whole plan</Link>}
      </div>
    </div>
  );
}
