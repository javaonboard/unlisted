import { SubmitButton } from "@/components/ui/submit-button";

const field = "h-9 rounded-full border bg-background px-3";

// Everything about an item or service is the owner's to change.
export function EditItem({ action, item }: { action: (f: FormData) => Promise<void>; item: { title: string; condition: string | null; estimatedValue: string | null; minPrice: string | null; openToOffers: boolean; kind: string; forSale: boolean; rentPerDay: string | null; deposit: string | null } }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-primary">Edit details</summary>
      <form action={action} className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1">Name<input name="title" defaultValue={item.title} className={field} /></label>
        <label className="flex flex-col gap-1">{item.kind === "skill" ? "About the service" : "Condition"}<input name="condition" defaultValue={item.condition ?? ""} className={field} /></label>
        <label className="flex flex-col gap-1">{item.kind === "skill" ? "Price per job ($)" : "Asking price ($)"}<input name="estimatedValue" type="number" min={0} defaultValue={item.estimatedValue ? Number(item.estimatedValue) : ""} className={field} /></label>
        <label className="flex flex-col gap-1">Lowest you&apos;d take ($, only you see it)<input name="minPrice" type="number" min={0} defaultValue={item.minPrice ? Number(item.minPrice) : ""} className={field} /></label>
        {item.kind === "goods" && (
          <>
            <label className="flex items-center gap-2"><input name="forSale" type="checkbox" defaultChecked={item.forSale} className="size-4 accent-primary" /> For sale</label>
            <span />
            <label className="flex flex-col gap-1">Rent per day ($, empty = not for rent)<input name="rentPerDay" type="number" min={0} defaultValue={item.rentPerDay ? Number(item.rentPerDay) : ""} className={field} /></label>
            <label className="flex flex-col gap-1">Deposit while rented ($)<input name="deposit" type="number" min={0} defaultValue={item.deposit ? Number(item.deposit) : ""} className={field} /></label>
          </>
        )}
        <label className="flex items-center gap-2"><input name="openToOffers" type="checkbox" defaultChecked={item.openToOffers} className="size-4 accent-primary" /> Open to offers (otherwise private)</label>
        <div className="sm:col-span-2"><SubmitButton size="sm">Save</SubmitButton></div>
      </form>
    </details>
  );
}

export function EditNeed({ action, need }: { action: (f: FormData) => Promise<void>; need: { text: string; maxPrice: string | null; dueAt: Date | null } }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-primary">Edit details</summary>
      <form action={action} className="mt-2 grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 sm:col-span-2">What you need<input name="text" defaultValue={need.text} className={field} /></label>
        <label className="flex flex-col gap-1">Budget ($, only you see it)<input name="maxPrice" type="number" min={0} defaultValue={need.maxPrice ? Number(need.maxPrice) : ""} className={field} /></label>
        <label className="flex flex-col gap-1">By<input name="dueAt" type="date" defaultValue={need.dueAt ? need.dueAt.toISOString().slice(0, 10) : ""} className={field} /></label>
        <div className="sm:col-span-2"><SubmitButton size="sm">Save</SubmitButton></div>
      </form>
    </details>
  );
}
