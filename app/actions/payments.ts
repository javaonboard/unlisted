"use server";

import { revalidatePath } from "next/cache";
import { currentUserId } from "@/lib/session";
import { approveDeal, cancelHold, confirmHandoff, createPayerOrder, holdPayment } from "@/lib/payments/legs";

const refresh = () => revalidatePath("/deals", "layout");

export async function approveDealAction(dealId: string) {
  await approveDeal(dealId, await currentUserId());
  refresh();
}

export async function createOrderAction(dealId: string) {
  return createPayerOrder(dealId, await currentUserId());
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

export async function cancelHoldAction(dealId: string) {
  await cancelHold(dealId, await currentUserId());
  refresh();
}
