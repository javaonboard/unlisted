import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("Set DATABASE_URL");

// Render's external URL needs SSL; the internal one (on Render) doesn't.
const sql = postgres(url, {
  ssl: url.includes(".render.com") ? "require" : false,
  max: 5,
  idle_timeout: 20, // drop idle connections before the server does
  connect_timeout: 10,
});

export const db = drizzle(sql, { schema });
export { schema, sql as pg }; // pg: the raw client, used for LISTEN/NOTIFY
