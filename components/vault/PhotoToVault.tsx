"use client";

import { useState, useTransition } from "react";
import { Camera } from "lucide-react";
import { IconCircle } from "@/components/anchors/Badges";
import { Button } from "@/components/ui/button";
import { addSuggestions, suggestFromPhoto, type Suggestion } from "@/app/actions/vault";

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

export function PhotoToVault() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [thumb, setThumb] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const onFile = (file?: File) => {
    if (!file) return;
    setError(null);
    setSuggestions([]);
    start(async () => {
      const [photo, small] = await Promise.all([shrink(file, 1280), shrink(file, 240, 0.7)]);
      setThumb(small);
      const result = await suggestFromPhoto(photo.split(",")[1]);
      setError(result.error);
      setSuggestions(result.suggestions);
      setPicked(new Set(result.suggestions.map((_, i) => i)));
    });
  };

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
            <label key={i} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm hover:bg-muted/40">
              <input type="checkbox" checked={picked.has(i)} onChange={() => toggle(i)} className="mt-1" />
              <span className="flex-1">
                <span className="font-medium">{s.title}{s.kind === "skill" ? " (service)" : ""}</span>
                {s.value ? <span className="text-muted-foreground"> · ~${s.value}</span> : null}
                <span className="block text-muted-foreground">{s.kind === "skill" ? `Because: ${s.note}` : s.note}</span>
                {s.demand && s.demand.requests > 0 && (
                  <span className="block text-primary">
                    {s.demand.requests} {s.demand.requests === 1 ? "neighbor asked" : "neighbors asked"} for this{s.demand.perJob ? ` · ~$${s.demand.perJob} per job` : ""}
                  </span>
                )}
              </span>
            </label>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setSuggestions([])}>Cancel</Button>
            <Button
              disabled={pending || picked.size === 0}
              onClick={() => start(async () => {
                await addSuggestions(suggestions.filter((_, i) => picked.has(i)), thumb);
                setSuggestions([]);
              })}
            >
              Add {picked.size} to my vault
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Everything stays private until you say yes to a real buyer.</p>
        </div>
      )}
    </div>
  );
}
