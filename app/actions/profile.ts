"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { newConnectorKey, setAddress, setPaypalEmail } from "@/lib/users/mutations";
import { payWaiting } from "@/lib/payments/legs";

export async function setAddressAction(form: FormData) {
  await setAddress(await currentUserId(), String(form.get("address") ?? ""));
  revalidatePath("/memory");
}

// Saving a PayPal email also sends any payouts that were waiting for it.
export async function setPaypalEmailAction(form: FormData) {
  const userId = await currentUserId();
  const error = await setPaypalEmail(userId, String(form.get("paypalEmail") ?? ""));
  if (!error) await payWaiting(userId);
  revalidatePath("/", "layout");
}

export async function newConnectorKeyAction() {
  await newConnectorKey(await currentUserId());
  revalidatePath("/connect");
}
