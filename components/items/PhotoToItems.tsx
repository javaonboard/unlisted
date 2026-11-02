"use client";

import { useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { IconCircle } from "@/components/shared/Badges";
import { Button } from "@/components/ui/button";
import { addSuggestions, suggestFromPhoto, type Suggestion } from "@/app/actions/items";
import { WaysSwitch } from "./WaysSwitch";

// Shrinks a photo in the browser so uploads stay small.
async function shrink(file: File, max: number, quality = 0.8) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function PhotoToItems() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [thumb, setThumb] = useState("");
  const [full, setFull] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = (file?: File) => {
    if (!file) return;
    setError(null);
    setSuggestions([]);
    start(async () => {
      const [photo, small] = await Promise.all([shrink(file, 1280), shrink(file, 240, 0.7)]);
      setThumb(small);
      setFull(photo);
      const result = await suggestFromPhoto(photo.split(",")[1]);
      setError(result.error);
      setSuggestions(result.suggestions);
      setPicked(new Set(result.suggestions.map((_, i) => i)));
    });
  };

  const change = (i: number, next: Partial<Suggestion>) => setSuggestions((list) => list.map((s, j) => (j === i ? { ...s, ...next } : s)));
  const toggle = (i: number) => setPicked((p) => { const n = new Set(p); if (n.has(i)) n.delete(i); else n.add(i); return n; });

  return (
    <div className="mb-6 rounded-2xl border border-dashed p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm"><IconCircle icon={Camera} /> Snap a room or your garage. Your agent finds what you own and what you could do.</p>
        <label className="shrink-0 cursor-pointer rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground">
          {pending ? "Looking…" : "Add a photo"}
          <input type="file" accept="image/*" capture="environment" className="hidden" disabled={pending} onChange={(e) => onFile(e.target.files?.[0])} />
        </label>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {suggestions.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          {suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border p-3 text-sm">
              <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="mt-2" aria-label={`Add ${s.title}`} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <input value={s.title} onChange={(e) => change(i, { title: e.target.value })} className="min-w-0 flex-1 rounded-lg border px-2 py-1 font-medium" aria-label="Name" />
                  <label className="flex items-center gap-1 text-muted-foreground">
                    $<input type="number" min={0} value={s.value ?? s.demand?.perJob ?? ""} onChange={(e) => change(i, { value: e.target.value ? Number(e.target.value) : null, priceEdited: true })} className="w-20 rounded-lg border px-2 py-1" aria-label={s.kind === "skill" ? "Price per job" : "Price"} />
                    {s.kind === "skill" ? "/job" : ""}
                  </label>
                </div>
                {s.kind === "goods" && (
                  <div className="flex flex-wrap items-center gap-2">
                    <WaysSwitch ways={s.ways?.includes("rent") ? (s.ways.includes("sell") ? "both" : "rent") : "sell"} onChange={(w) => change(i, { ways: w === "both" ? ["sell", "rent"] : [w], rentPerDay: w === "sell" ? null : (s.rentPerDay ?? Math.max(5, Math.round((s.value ?? 0) * 0.04))) })} />
                    {s.ways?.includes("rent") && (
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        $<input type="number" min={0} value={s.rentPerDay ?? ""} onChange={(e) => change(i, { rentPerDay: e.target.value ? Number(e.target.value) : null })} className="w-14 rounded-lg border px-1.5 py-0.5" aria-label="Rent per day" />/day
                      </label>
                    )}
                  </div>
                )}
                <span className="text-muted-foreground">{s.kind === "skill" ? `A service you could offer, because: ${s.note}` : s.note}</span>
                {s.demand && s.demand.requests > 0 && (
                  <span className="text-primary">
                    {s.demand.requests} {s.demand.requests === 1 ? "neighbor asked" : "neighbors asked"} for this{s.demand.perJob ? ` · ~$${s.demand.perJob} per job` : ""}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSuggestions([])}>Cancel</Button>
            <Button
              loading={pending}
              disabled={picked.size === 0}
              onClick={() => start(async () => {
                await addSuggestions(suggestions.filter((_, i) => picked.has(i)), thumb, full);
                setSuggestions([]);
              })}
            >
              Add {picked.size} to my stuff
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Prices from a photo are a first guess: your agent checks the market next. Missed something? Tell your agent above, like “I can also mount TVs”. Everything stays private until you say yes to a real buyer.</p>
        </div>
      )}
    </div>
  );
}
