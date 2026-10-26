CREATE TYPE "public"."credit_role" AS ENUM('director', 'writer', 'creator', 'cast');--> statement-breakpoint
CREATE TYPE "public"."media_type" AS ENUM('movie', 'tv');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('everyone', 'friends', 'private');--> statement-breakpoint
CREATE TABLE "credits" (
	"title_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"role" "credit_role" NOT NULL,
	"character" text,
	"order" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "credits_title_id_person_id_role_pk" PRIMARY KEY("title_id","person_id","role")
);
--> statement-breakpoint
CREATE TABLE "people" (
	"tmdb_id" integer PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"profile_path" text
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "titles" (
	"id" serial PRIMARY KEY NOT NULL,
	"tmdb_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" text NOT NULL,
	"original_title" text,
	"year" integer,
	"release_date" date,
	"poster_path" text,
	"backdrop_path" text,
	"overview" text,
	"runtime" integer,
	"genres" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"countries" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"original_language" text,
	"imdb_id" text,
	"vote_average" real,
	"seasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_titles" (
	"user_id" integer NOT NULL,
	"title_id" integer NOT NULL,
	"prior_watch_count" integer DEFAULT 0 NOT NULL,
	"on_watchlist" boolean DEFAULT false NOT NULL,
	"watchlisted_at" timestamp with time zone,
	CONSTRAINT "user_titles_user_id_title_id_pk" PRIMARY KEY("user_id","title_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"visibility" "visibility" DEFAULT 'everyone' NOT NULL,
	"hide_watched" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE TABLE "viewings" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"title_id" integer NOT NULL,
	"watched_on" date,
	"season_number" integer,
	"rating" smallint,
	"liked" boolean DEFAULT false NOT NULL,
	"is_rewatch" boolean DEFAULT false NOT NULL,
	"review_html" text,
	"is_main_review" boolean DEFAULT false NOT NULL,
	"contains_spoilers" boolean DEFAULT false NOT NULL,
	"watched_where" text,
	"format" text,
	"watched_with" text,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credits" ADD CONSTRAINT "credits_person_id_people_tmdb_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("tmdb_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_titles" ADD CONSTRAINT "user_titles_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "viewings" ADD CONSTRAINT "viewings_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credits_person_idx" ON "credits" USING btree ("person_id");--> statement-breakpoint
CREATE UNIQUE INDEX "titles_tmdb_idx" ON "titles" USING btree ("tmdb_id","media_type");--> statement-breakpoint
CREATE INDEX "viewings_user_date_idx" ON "viewings" USING btree ("user_id","watched_on");--> statement-breakpoint
CREATE INDEX "viewings_title_idx" ON "viewings" USING btree ("title_id");