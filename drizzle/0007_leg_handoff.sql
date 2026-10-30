ALTER TABLE "deal_legs" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD COLUMN "handoff_code" text;--> statement-breakpoint
ALTER TABLE "deal_legs" ADD CONSTRAINT "deal_legs_room_id_negotiations_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."negotiations"("id") ON DELETE no action ON UPDATE no action;