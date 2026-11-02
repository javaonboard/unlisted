"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { setItemRange } from "@/lib/items/mutations";
import { setNeedRange } from "@/lib/intents/mutations";

export async function setItemRangeAction(itemId: string, form: FormData) {
  await setItemRange(await currentUserId(), itemId, Number(form.get("miles")));
  revalidatePath("/", "layout");
}

export async function setNeedRangeAction(needId: string, form: FormData) {
  await setNeedRange(await currentUserId(), needId, Number(form.get("miles")));
  revalidatePath("/", "layout");
}
