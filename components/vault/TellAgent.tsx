"use client";

import { useState, useTransition } from "react";
import { FormattedText } from "@/components/FormattedText";
import { Button } from "@/components/ui/button";
import { saveCards, understandAction } from "@/app/actions/vault";
import { missing, type Card } from "@/lib/vault/card";

const label = { goods: "Item", skill: "Service you offer", need: "Need" };

// Talk to your agent: things you own, services you offer, or what you need.
// If something important is missing, the agent asks, and your answers add up until it's complete.
export function TellAgent() {
  const [text, setText] = useState("");
  const [said, setSaid] = useState<string[]>([]);
  const [cards, setCards] = useState<Card[]>([]);
  const [question, setQuestion] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const complete = cards.length > 0 && cards.every((c) => missing(c).length === 0);
  const reset = () => { setCards([]); setSaid([]); setQuestion(null); setText(""); };

  return (
    <div className="rounded-2xl border p-4">
      {said.length > 0 && (
        <div className="mb-3 flex flex-col gap-2 text-sm">
          {said.map((s, i) => <p key={i} className="self-end rounded-2xl bg-primary px-3 py-1.5 text-primary-foreground">{s}</p>)}
          {question && <FormattedText text={question} className="self-start rounded-2xl bg-accent px-3 py-1.5" />}
        </div>
      )}

      {cards.length > 0 && (
        <div className="mb-3 flex flex-col gap-2">
          {cards.map((c, i) => (
            <div key={i} className="rounded-xl border p-3 text-sm">
              <span className="text-xs text-muted-foreground">{label[c.kind]}</span>
              <p className="font-medium">{c.title}</p>
              <p className="text-muted-foreground">
                {[c.details, c.condition, c.ways?.includes("rent") && c.rentPerDay ? `for rent $${c.rentPerDay}/day` : null, c.needType === "rent" && c.days ? `rent for ${c.days} day${c.days === 1 ? "" : "s"}` : null, c.value !== null ? `~$${c.value}${c.kind === "skill" ? "/job" : ""}` : null, c.minPrice !== null ? `lowest $${c.minPrice}` : null, c.maxPrice !== null ? `up to $${c.maxPrice}` : null, c.dueInDays !== null ? `within ${c.dueInDays} days` : null, c.freeHours.length ? `${c.freeHours.length} free slots` : null].filter(Boolean).join(" · ") || c.category}
              </p>
              {missing(c).length > 0 && <p className="mt-1 text-xs text-amber-700">Still need: {missing(c).join(", ")}</p>}
            </div>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>Cancel</Button>
            <Button
              disabled={pending || !complete}
              onClick={() => start(async () => {
                await saveCards(cards, said.join(" "));
                reset();
              })}
            >
              Save
            </Button>
          </div>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!text.trim()) return;
          const next = [...said, text.trim()];
          start(async () => {
            const result = await understandAction(next.join("\n"));
            setError(result.error);
            if (result.error) return;
            setSaid(next);
            setCards(result.cards);
            setQuestion(result.question);
            setText("");
          });
        }}
      >
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={question ? "Answer your agent…" : "Tell your agent: “I have a ladder and free Saturdays” or “I need my lawn mowed”"}
          className="h-10 flex-1 rounded-full border bg-background px-4 text-sm"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !text.trim()}>{pending ? "…" : "Send"}</Button>
      </form>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
    </div>
  );
}
