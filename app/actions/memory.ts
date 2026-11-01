"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { addFact, confirmFact, deleteFact, editFact } from "@/lib/memory/queries";

export async function confirmFactAction(id: string) {
  await confirmFact(id, await currentUserId());
  revalidatePath("/memory");
}

export async function deleteFactAction(id: string) {
  await deleteFact(id, await currentUserId());
  revalidatePath("/memory");
}

export async function editFactAction(id: string, formData: FormData) {
  const fact = String(formData.get("fact") ?? "").trim();
  if (fact) await editFact(id, await currentUserId(), fact);
  revalidatePath("/memory");
}

export async function addFactAction(formData: FormData) {
  const fact = String(formData.get("fact") ?? "").trim().slice(0, 200);
  if (fact) await addFact(await currentUserId(), fact);
  revalidatePath("/memory");
}
