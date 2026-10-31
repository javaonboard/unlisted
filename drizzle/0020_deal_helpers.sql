ALTER TABLE "deals" DROP CONSTRAINT "deals_service_id_intents_id_fk";
--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "helper_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;