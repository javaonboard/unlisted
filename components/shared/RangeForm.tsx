import { SubmitButton } from "@/components/ui/submit-button";

// "How far will you go?" with a small number box.
export function RangeForm({ action, miles, label }: { action: (form: FormData) => Promise<void>; miles: number; label: string }) {
  return (
    <form action={action} className="mt-3 flex items-center gap-2 text-sm">
      <span>{label}</span>
      <input name="miles" type="number" min={0} max={50} defaultValue={miles} className="h-8 w-16 rounded-full border bg-background px-3" />
      <span>mi</span>
      <SubmitButton size="sm" variant="outline">Save</SubmitButton>
    </form>
  );
}
