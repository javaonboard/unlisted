"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormattedText } from "@/components/FormattedText";
import { askMoneyAction } from "@/app/actions/money";

// Ask your agent about your money. It checks PayPal live for your own orders.
export function AskMoney() {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <div className="rounded-2xl border p-4 text-sm">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (!question.trim()) return;
          start(async () => {
            const result = await askMoneyAction(question);
            setAnswer(result.answer);
            setError(result.error);
          });
        }}
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Ask your agent, e.g. “Has Bella's payment gone through?”"
          className="h-10 flex-1 rounded-full border bg-background px-4"
          disabled={pending}
        />
        <Button type="submit" disabled={pending || !question.trim()}>{pending ? "Checking PayPal…" : "Ask"}</Button>
      </form>
      {answer && <FormattedText text={answer} className="mt-3 rounded-xl bg-accent px-3 py-2" />}
      {error && <p className="mt-2 text-destructive">{error}</p>}
    </div>
  );
}
