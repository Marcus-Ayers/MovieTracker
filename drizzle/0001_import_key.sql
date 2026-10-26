ALTER TABLE "viewings" ADD COLUMN "import_key" text;--> statement-breakpoint
CREATE UNIQUE INDEX "viewings_import_key_idx" ON "viewings" USING btree ("user_id","import_key");