CREATE TABLE "plex_connections" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"client_id" text NOT NULL,
	"auth_token" text,
	"pending_pin_id" integer,
	"server_name" text,
	"server_id" text,
	"server_token" text,
	"server_uri" text,
	"account_id" integer,
	"account_name" text,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_summary" text
);
--> statement-breakpoint
CREATE TABLE "plex_items" (
	"server_id" text NOT NULL,
	"rating_key" text NOT NULL,
	"tmdb_id" integer,
	"media_type" "media_type",
	"title" text,
	"year" integer,
	CONSTRAINT "plex_items_server_id_rating_key_pk" PRIMARY KEY("server_id","rating_key")
);
--> statement-breakpoint
ALTER TABLE "plex_connections" ADD CONSTRAINT "plex_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;