"use client";

import { useTransition } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { switchPersona } from "@/app/actions/persona";

type Persona = { id: string; name: string; area: string; bio: string | null };

export function PersonaSwitcher({ personas, current }: { personas: Persona[]; current: string }) {
  const [pending, startTransition] = useTransition();
  const items = personas.map((p) => ({ value: p.id, label: `${p.name} · ${p.area}`, bio: p.bio }));

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
            <span className="flex flex-col">
              <span>{item.label}</span>
              {item.bio && <span className="text-xs text-muted-foreground">{item.bio}</span>}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
