CREATE TABLE "bookings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_id" text NOT NULL,
	"title" text NOT NULL,
	"starts_at" timestamp NOT NULL,
	"ends_at" timestamp NOT NULL,
	"deal_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "negotiations" ALTER COLUMN "max_rounds" SET DEFAULT 8;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "deal_id" uuid;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "label" text;--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "buyer_limit" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "negotiations" ADD COLUMN "seller_limit" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_provider_id_users_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;