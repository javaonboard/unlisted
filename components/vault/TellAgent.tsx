"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { saveCards, understandAction } from "@/app/actions/vault";
import type { Card } from "@/lib/vault/understand";

const label = { goods: "Item", skill: "🛠️ Service you offer", need: "Need" };

// One box for everything: things you own, services you offer, or what you need.
export function TellAgent() {
  const [text, setText] = useState("");
  const [cards, setCards] = useState<Card[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mb-6 rounded-2xl border p-4">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          start(async () => {
            const result = await understandAction(text);
            setError(result.error);
            setCards(result.cards);
          });
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="💬 Tell your agent: “I have a ladder and free Saturdays” or “I need my lawn mowed”"
          className="h-10 flex-1 rounded-full border bg-background px-4 text-sm"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !text.trim()}>{pending ? "…" : "Tell"}</Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}

      {cards.length > 0 && (
        <div className="mt-3 flex flex-col gap-2">
          {cards.map((c, i) => (
            <div key={i} className="rounded-xl border p-3 text-sm">
              <span className="text-xs text-muted-foreground">{label[c.kind]}</span>
              <p className="font-medium">{c.title}</p>
              <p className="text-muted-foreground">
                {[c.condition, c.value ? `~$${c.value}` : null, c.maxPrice ? `up to $${c.maxPrice}` : null, c.dueInDays ? `within ${c.dueInDays} days` : null].filter(Boolean).join(" · ") || c.category}
              </p>
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCards([])}>Cancel</Button>
            <Button
              disabled={pending}
              onClick={() => start(async () => {
                await saveCards(cards);
                setCards([]);
                setText("");
              })}
            >
              Save
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
