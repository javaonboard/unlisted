import { ShieldCheck } from "lucide-react";
import { dealHistory } from "@/lib/views/queries";

const time = (d: Date) => d.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

// The deal's record: who did what and when, with PayPal's own confirmations marked.
export async function History({ roomId, legId }: { roomId: string; legId: string | null }) {
  const steps = await dealHistory(roomId, legId);
  if (!steps.length) return null;
  return (
    <details className="mt-4 rounded-2xl border p-4 text-sm">
      <summary className="cursor-pointer font-medium">What happened ({steps.length})</summary>
      <ol className="mt-3 flex flex-col gap-2 border-l pl-4">
        {steps.map((s) => (
          <li key={s.id}>
            <span className="flex items-center gap-1.5">
              {s.paypal && <ShieldCheck className="size-4 shrink-0 text-primary" aria-label="Signed PayPal webhook" />}
              <span className={s.paypal ? "text-primary" : ""}>{s.message}</span>
            </span>
            <span className="text-xs text-muted-foreground">{time(s.at)}{s.paypal ? " · verified PayPal webhook" : ""}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
