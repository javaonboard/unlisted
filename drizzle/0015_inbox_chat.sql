ALTER TABLE "notifications" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "from_me" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_room_id_negotiations_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."negotiations"("id") ON DELETE no action ON UPDATE no action;