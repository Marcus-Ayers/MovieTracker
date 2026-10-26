ALTER TABLE "titles" ADD COLUMN "collection_id" integer;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "collection_name" text;--> statement-breakpoint
ALTER TABLE "titles" ADD COLUMN "collection_checked" boolean DEFAULT false NOT NULL;