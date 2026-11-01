ALTER TABLE "deal_legs" ADD COLUMN "confirmed" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "vault_items" ADD COLUMN "sold_at" timestamp;