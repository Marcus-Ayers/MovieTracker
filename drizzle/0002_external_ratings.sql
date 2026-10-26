CREATE TABLE "external_ratings" (
	"imdb_id" text PRIMARY KEY NOT NULL,
	"imdb" text,
	"rotten_tomatoes" text,
	"metacritic" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);
