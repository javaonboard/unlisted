ALTER TABLE "deal_legs" ADD COLUMN "captured_at" timestamp;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "paid_out_at" timestamp;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "sale_waits_for_purchase" boolean DEFAULT false NOT NULL;