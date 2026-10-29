import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/lib/db";

export async function listPersonas() {
  return db
    .select({ id: schema.users.id, name: schema.users.name, area: schema.users.area })
    .from(schema.users)
    .orderBy(asc(schema.users.name));
}

export async function getUser(id: string) {
  const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
  return user;
}
