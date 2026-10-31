ALTER TABLE "deal_legs" ADD COLUMN "deposit" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "intents" ADD COLUMN "days" integer;--> statement-breakpoint
ALTER TABLE "vault_items" ADD COLUMN "for_sale" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_items" ADD COLUMN "rent_per_day" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "vault_items" ADD COLUMN "deposit" numeric(10, 2);