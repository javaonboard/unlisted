ALTER TABLE "deal_legs" ADD COLUMN "problem" jsonb;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "refund_id" text;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "backed_out_by" text;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "back_out_reason" text;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "back_out_note" text;