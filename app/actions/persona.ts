"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { PERSONA_COOKIE } from "@/lib/session";

export async function switchPersona(id: string) {
  (await cookies()).set(PERSONA_COOKIE, id, { path: "/" });
  revalidatePath("/", "layout");
}
