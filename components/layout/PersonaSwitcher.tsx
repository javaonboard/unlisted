"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { switchPersona } from "@/app/actions/persona";

type Persona = { id: string; name: string; area: string };

export function PersonaSwitcher({ personas, current }: { personas: Persona[]; current: string }) {
  const [pending, startTransition] = useTransition();
  const items = personas.map((p) => ({ value: p.id, label: `${p.name} · ${p.area}` }));

  return (
    <Select
      items={items}
      value={current}
      onValueChange={(id) => id && startTransition(() => switchPersona(id))}
    >
      <SelectTrigger className="w-56" disabled={pending}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
