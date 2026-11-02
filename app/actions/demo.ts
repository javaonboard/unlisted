"use server";

import { revalidatePath } from "next/cache";
import { resetDemo } from "@/lib/demo/snapshot";

// Anyone trying the demo can put it back to the start.
export async function resetDemoAction() {
  await resetDemo("button");
  revalidatePath("/", "layout");
}
