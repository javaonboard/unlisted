ALTER TABLE "users" ADD COLUMN "connector_key" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_connector_key_unique" UNIQUE("connector_key");