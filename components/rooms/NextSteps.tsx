import Link from "next/link";
import { Check, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cancelHoldAction } from "@/app/actions/payments";
import { PayButton } from "@/components/payments/PayButton";
import { ConfirmHandoff, ConfirmReturn } from "@/components/payments/LegActions";
import { AcceptDeal } from "@/components/rooms/AcceptDeal";
import { FEE, feeOf, money, payoutOf } from "@/lib/payments/fees";
import { mapsLink } from "@/lib/places";
import type { MeetAt } from "@/lib/deals/meet";

type Props = {
  roomId: string;
  dealId: string | null;
  isPlan: boolean;
  viewerId: string;
  buyerId: string;
  sellerId: string;
  first: (id: string) => string;
  leg: { id: string; kind: string; payerId: string; payeeId: string; amount: string; deposit: string | null; status: string; handoffCode: string | null } | null;
  price: number;
  deposit: number;
  booking: { startsAt: Date; endsAt: Date } | null;
  waitingOn: string[];
  meet: { meetAt: MeetAt; label: string; address: string | null } | null;
  places: MeetAt[];
  stops: string[];
  rentalDays: number | null;
  blockedBy: string | null;
  clientId: string;
};

type State = "done" | "now" | "later";

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
  const paid = ["held", "in_use", "captured", "paid_out"].includes(status);
  const handedOff = ["captured", "paid_out"].includes(status) || (rental && status === "in_use");
  const paidOut = status === "paid_out";
  const cancelled = status === "voided";
  const others = p.waitingOn.filter((id) => id !== p.viewerId).map(p.first).join(" and ");
  const stateOf = (done: boolean, ready: boolean): State => (done ? "done" : ready ? "now" : "later");

  return (
    <div className="mt-3 rounded-2xl border p-4 text-sm">
      <ol className="flex flex-col gap-3">
        <Step n={1} title={`Deal agreed at ${money(p.price)}`} state="done">
          <p className="text-muted-foreground">
            {p.booking ? `${time(p.booking.startsAt)}${rental ? ` to ${time(p.booking.endsAt)}` : ""}` : ""}
            {p.meet ? ` · ${p.meet.label}` : ""}
          </p>
          {p.stops.length > 0 && <ol className="mt-1 list-decimal space-y-0.5 pl-5 text-muted-foreground">{p.stops.map((s) => <li key={s}>{s}</li>)}</ol>}
          {p.blockedBy && <p className="mt-1 text-amber-700">Part of a plan: waiting for {p.blockedBy}.</p>}
        </Step>

        <Step n={2} title={accepted ? "Accepted by both" : "Accept the deal, time and place"} state={stateOf(accepted, !p.blockedBy)}>
          {!accepted && others && !p.waitingOn.includes(p.viewerId) && <p className="text-muted-foreground">You accepted. Waiting for {others}.</p>}
          {!handedOff && !cancelled && p.booking && p.meet && !p.blockedBy && (
            <AcceptDeal
              roomId={p.roomId}
              canAccept={p.waitingOn.includes(p.viewerId)}
              place={{ meetAt: p.meet.meetAt, isSeller: p.sellerId === p.viewerId, other: p.first(iPay ? p.sellerId : p.buyerId), allowed: p.places }}
            />
          )}
        </Step>

        <Step n={3} title={paid ? "Paid, PayPal is holding it" : rental ? "Pay the fee and deposit with PayPal" : "Pay with PayPal"} state={stateOf(paid, accepted && !cancelled)}>
          <p className="text-muted-foreground">
            {iPay
              ? `You pay ${money(p.price)}${p.deposit ? ` plus a ${money(p.deposit)} deposit you get back` : ""}. PayPal only charges after the ${rental ? "return" : "handoff"}.`
              : `${p.first(p.buyerId)} pays ${money(p.price)} · Unlisted fee ${FEE * 100}% (${money(feeOf(p.price))}) · you get ${money(payoutOf(p.price))}`}
          </p>
          {accepted && leg && status === "pending" && iPay && (
            <div className="mt-2"><PayButton legId={leg.id} clientId={p.clientId} total={Number(leg.amount)} deposit={Number(leg.deposit ?? 0)} /></div>
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
          {status === "held" && !iPay && <p className="mt-1">Show this code at the {rental ? "pickup" : "handoff"}: <span className="font-mono text-base font-semibold">{leg?.handoffCode}</span></p>}
          {status === "held" && iPay && leg && <ConfirmHandoff legId={leg.id} />}
          {status === "held" && iPay && leg && (
            <form action={cancelHoldAction.bind(null, leg.id)} className="mt-1">
              <Button size="sm" variant="ghost">Cancel and release the hold</Button>
            </form>
          )}
          {status === "in_use" && !iPay && leg && <ConfirmReturn legId={leg.id} deposit={Number(leg.deposit ?? 0)} />}
          {status === "in_use" && iPay && <p className="mt-1">Bring it back by {p.booking ? time(p.booking.endsAt) : "the end date"}; then the deposit is released.</p>}
        </Step>

        <Step n={5} title={paidOut ? `Paid out to ${p.first(p.sellerId)}` : "PayPal pays out"} state={stateOf(paidOut, status === "captured")}>
          {paidOut && <p className="text-muted-foreground">{p.sellerId === p.viewerId ? `${money(payoutOf(p.price))} sent to your PayPal.` : "All done."}</p>}
        </Step>
      </ol>

      <div className="mt-3 flex gap-4 text-xs">
        {leg && <Link href={`/money/${leg.id}`} className="text-primary hover:underline">Receipt</Link>}
        {p.isPlan && p.dealId && <Link href={`/deals/${p.dealId}`} className="text-muted-foreground hover:text-foreground">See the whole plan</Link>}
      </div>
    </div>
  );
}
