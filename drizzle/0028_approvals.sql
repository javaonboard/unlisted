ALTER TABLE "negotiations" ADD COLUMN "buyer_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "seller_approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "nudged_at" timestamp;