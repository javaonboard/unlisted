import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Check } from "lucide-react";
import { currentUserId } from "@/lib/session";
import { getReceipt } from "@/lib/money/receipt";
import { BackLink } from "@/components/anchors/BackLink";

const when = (d: Date) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const usd = (n: number) => `${n < 0 ? "−" : ""}$${Math.abs(n).toFixed(2)}`;

// A receipt for one payment: the money, what happened when, and PayPal's references and live status.
async function Receipt({ params }: { params: Promise<{ id: string }> }) {
  const r = await getReceipt((await params).id, await currentUserId());
  if (!r) notFound();
  return (
    <>
      <BackLink href="/money" label="My money" />
      <h1 className="text-2xl font-semibold">{r.leg.description}</h1>
      <p className="mb-4 text-sm text-muted-foreground">Receipt {r.leg.id.slice(0, 8).toUpperCase()} · {r.payer} pays {r.payee}</p>

      <section className="mb-4 rounded-2xl border p-4 text-sm">
        {r.lines.map((l) => (
          <p key={l.label} className="flex justify-between py-0.5"><span className="text-muted-foreground">{l.label}</span><span className="font-medium">{usd(l.amount)}</span></p>
        ))}
      </section>

      <section className="mb-4 rounded-2xl border p-4 text-sm">
        <p className="mb-2 font-medium">What happened</p>
        <ol className="flex flex-col gap-1.5">
          {r.timeline.map((t) => (
            <li key={t.label} className={`flex items-center gap-2 ${t.at ? "" : "text-muted-foreground"}`}>
              <span className={`flex size-4 items-center justify-center rounded-full ${t.at ? "bg-primary text-primary-foreground" : "border"}`}>{t.at && <Check className="size-3" />}</span>
              {t.label}{t.at ? <span className="text-muted-foreground"> · {when(t.at)}</span> : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="rounded-2xl border p-4 text-sm">
        <p className="mb-2 font-medium">PayPal</p>
        {r.paypalStatus && <p className="mb-2">Live status: <span className="font-medium">{r.paypalStatus}</span></p>}
        {r.paypal.filter((p) => p.id).map((p) => (
          <p key={p.label} className="flex justify-between gap-3 py-0.5"><span className="text-muted-foreground">{p.label}</span><span className="font-mono text-xs">{p.id}</span></p>
        ))}
        {!r.leg.orderId && <p className="text-muted-foreground">Not paid yet.</p>}
      </section>
      {r.leg.roomId && <Link href={`/rooms/${r.leg.roomId}`} className="mt-3 inline-block text-xs text-primary hover:underline">See the deal</Link>}
    </>
  );
}

export default function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-8">
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <Receipt params={params} />
      </Suspense>
    </main>
  );
}
