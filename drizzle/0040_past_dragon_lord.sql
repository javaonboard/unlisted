CREATE TABLE "demo_snapshots" (
	"id" text PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"taken_at" timestamp NOT NULL,
	"reset_at" timestamp
);
