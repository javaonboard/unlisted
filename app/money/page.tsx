import { Suspense } from "react";
import Link from "next/link";
import { currentUserId } from "@/lib/session";
import { myMoney } from "@/lib/money/ask";
import { money, payoutOf } from "@/lib/payments/fees";
import { BackLink } from "@/components/anchors/BackLink";
import { AskMoney } from "@/components/money/AskMoney";

const STATUS: Record<string, string> = {
  pending: "Not paid yet",
  held: "Held by PayPal",
  in_use: "Rented out, deposit held",
  captured: "Charged",
  paid_out: "Paid out",
  voided: "Released, nothing charged",
  refunded: "Refunded",
};

async function MyMoney() {
  const rows = await myMoney(await currentUserId());
  return (
    <>
      <AskMoney />
      <ul className="mt-4 flex flex-col gap-2 text-sm">
        {rows.length === 0 && <li className="text-muted-foreground">No payments yet.</li>}
        {rows.map((r) => (
          <li key={r.id}>
          <Link href={`/money/${r.id}`} className="flex items-center justify-between gap-3 rounded-xl border p-3 hover:bg-muted/40">
            <span>
              <span className="font-medium">{r.what}</span>
              <span className="text-muted-foreground"> · {r.youPay ? `you pay ${r.other}` : `${r.other} pays you`}</span>
            </span>
            <span className="shrink-0 text-right">
              {r.youPay ? money(r.amount) : `${money(payoutOf(r.amount))} after fees`}
              {r.deposit ? <span className="text-muted-foreground"> + {money(r.deposit)} deposit</span> : null}
              <span className="block text-xs text-muted-foreground">{STATUS[r.status] ?? r.status} · receipt</span>
            </span>
          </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

export default function MoneyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <BackLink href="/" label="Inbox" />
      <h1 className="mb-1 text-2xl font-semibold">My money</h1>
      <p className="mb-4 text-muted-foreground">What you pay and get paid, with a receipt for each. Your agent can check any of your orders with PayPal live.</p>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <MyMoney />
      </Suspense>
    </main>
  );
}
