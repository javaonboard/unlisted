import { existsSync } from "node:fs";
import { defineConfig } from "drizzle-kit";

// Local runs read .env.local; on Render the env is already set.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

// Render's external URL needs SSL.
const url = process.env.DATABASE_URL!;
const withSsl = url.includes(".render.com") && !url.includes("sslmode") ? `${url}?sslmode=require` : url;

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: withSsl },
});
