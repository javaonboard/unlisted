ALTER TABLE "bookings" ALTER COLUMN "provider_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "bookings" ADD COLUMN "room_id" uuid;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_room_id_negotiations_id_fk" FOREIGN KEY ("room_id") REFERENCES "public"."negotiations"("id") ON DELETE no action ON UPDATE no action;