"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { setAddress } from "@/lib/users/mutations";

export async function setAddressAction(form: FormData) {
  await setAddress(await currentUserId(), String(form.get("address") ?? ""));
  revalidatePath("/memory");
}
