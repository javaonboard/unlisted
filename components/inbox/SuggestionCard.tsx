import { Button } from "@/components/ui/button";
import { Lightbulb } from "lucide-react";
import { acceptSuggestionAction, dismissSuggestionAction } from "@/app/actions/suggestions";

export function SuggestionCard({ s }: { s: { id: string; title: string; body: string } }) {
  return (
    <div className="rounded-2xl border bg-accent/50 p-4">
      <p className="flex items-center gap-2 font-medium"><Lightbulb className="size-4 text-primary" /> {s.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
      <div className="mt-3 flex gap-2">
        <form action={acceptSuggestionAction.bind(null, s.id)}><Button size="sm" type="submit">Yes</Button></form>
        <form action={dismissSuggestionAction.bind(null, s.id)}><Button size="sm" variant="ghost" type="submit">Not now</Button></form>
      </div>
    </div>
  );
}
