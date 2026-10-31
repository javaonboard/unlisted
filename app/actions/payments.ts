"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { cancelHold, confirmHandoff, confirmReturn, createPayerOrder, holdPayment } from "@/lib/payments/legs";

const refresh = () => revalidatePath("/", "layout");

// Called by PayPal's button when the payer clicks it: one order for this deal.
export async function createOrderAction(legId: string) {
  return createPayerOrder(legId, await currentUserId());
}

export async function holdPaymentAction(orderId: string) {
  await holdPayment(orderId, await currentUserId());
  refresh();
}

export async function confirmHandoffAction(legId: string, code: string) {
  try {
    await confirmHandoff(legId, await currentUserId(), code);
  } catch (error) {
    return { error: (error as Error).message };
  }
  refresh();
  return { error: null };
}

export async function cancelHoldAction(legId: string) {
  await cancelHold(legId, await currentUserId());
  refresh();
}

export async function confirmReturnAction(legId: string, goodShape: boolean) {
  await confirmReturn(legId, await currentUserId(), goodShape);
  refresh();
}
