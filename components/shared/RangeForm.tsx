"use client";

import { useState } from "react";
import { SubmitButton } from "@/components/ui/submit-button";

// "How far will you go?" with a small number box. Goods can also be pickup only (the same as 0 miles).
export function RangeForm({ action, miles, label, pickup = false }: { action: (form: FormData) => Promise<void>; miles: number; label: string; pickup?: boolean }) {
  const [value, setValue] = useState(String(miles));
  const pickupOnly = pickup && Number(value) === 0;
  return (
    <form action={action} className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span>{label}</span>
      <input
        type="number"
        min={0}
        max={50}
        value={pickupOnly ? "" : value}
        disabled={pickupOnly}
        onChange={(e) => setValue(e.target.value)}
        className="h-8 w-16 rounded-full border bg-background px-3 disabled:opacity-50"
        aria-label="Miles"
      />
      <span>mi</span>
      {pickup && (
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={pickupOnly} onChange={(e) => setValue(e.target.checked ? "0" : "5")} />
          Pickup only
        </label>
      )}
      <input type="hidden" name="miles" value={pickupOnly ? "0" : value} />
      <SubmitButton size="sm" variant="outline">Save</SubmitButton>
    </form>
  );
}
