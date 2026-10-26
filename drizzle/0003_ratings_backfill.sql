CREATE TABLE "api_usage" (
	"day" date NOT NULL,
	"service" text NOT NULL,
	"calls" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "api_usage_day_service_pk" PRIMARY KEY("day","service")
);
--> statement-breakpoint
CREATE TABLE "imdb_ratings" (
	"tconst" text PRIMARY KEY NOT NULL,
	"rating" real NOT NULL,
	"votes" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"last_run_at" timestamp with time zone NOT NULL,
	"summary" text
);
--> statement-breakpoint
ALTER TABLE "external_ratings" ADD COLUMN "year" integer;--> statement-breakpoint
CREATE INDEX "imdb_ratings_votes_idx" ON "imdb_ratings" USING btree ("votes");