import { SubmitButton } from "@/components/ui/submit-button";
import { FormattedText } from "@/components/FormattedText";
import { Lightbulb } from "lucide-react";
import { IconCircle } from "@/components/shared/Badges";
import { acceptSuggestionAction, dismissSuggestionAction } from "@/app/actions/suggestions";
import { PlanChoices } from "@/components/inbox/PlanChoices";

export function SuggestionCard({ s }: { s: { id: string; kind: string; title: string; body: string; action: Record<string, string | number> } }) {
  return (
    <div className="rounded-2xl border bg-accent/50 p-4">
      <p className="flex items-center gap-2 font-medium"><IconCircle icon={Lightbulb} size="size-7" /> {s.title}</p>
      <FormattedText text={s.body} className="mt-1 text-sm text-muted-foreground" />
      <div className="mt-3 flex flex-wrap gap-2">
        <form action={acceptSuggestionAction.bind(null, s.id)}><SubmitButton size="sm">{String(s.action.label ?? "Yes")}</SubmitButton></form>
        {s.kind === "plan" && <PlanChoices id={s.id} parts={JSON.parse(String(s.action.parts))} linked={Boolean(s.action.sellWaitsForBuy)} />}
        <form action={dismissSuggestionAction.bind(null, s.id)}><SubmitButton size="sm" variant="ghost">Not now</SubmitButton></form>
      </div>
    </div>
  );
}
