ALTER TABLE "bookings" DROP CONSTRAINT "bookings_provider_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "bookings" ALTER COLUMN "user_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "bookings" DROP COLUMN "provider_id";