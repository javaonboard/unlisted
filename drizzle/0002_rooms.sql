ALTER TABLE "offers" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "round" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "max_rounds" integer DEFAULT 6 NOT NULL;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "agreed_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "closed_reason" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "round" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "kind" text NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "reasoning" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "signals_used" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "a2a" jsonb;