import { cookies } from "next/headers";

export const PERSONA_COOKIE = "persona";

// The demo has no login. The current persona is kept in a cookie.
export async function currentUserId(): Promise<string> {
  return (await cookies()).get(PERSONA_COOKIE)?.value ?? "maya";
}
