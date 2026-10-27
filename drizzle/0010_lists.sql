CREATE TYPE "public"."list_kind" AS ENUM('list', 'tier');--> statement-breakpoint
CREATE TABLE "list_items" (
	"list_id" integer NOT NULL,
	"title_id" integer NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"tier" text,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "list_items_list_id_title_id_pk" PRIMARY KEY("list_id","title_id")
);
--> statement-breakpoint
CREATE TABLE "lists" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"kind" "list_kind" DEFAULT 'list' NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"ranked" boolean DEFAULT false NOT NULL,
	"tiers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_list_id_lists_id_fk" FOREIGN KEY ("list_id") REFERENCES "public"."lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "list_items" ADD CONSTRAINT "list_items_title_id_titles_id_fk" FOREIGN KEY ("title_id") REFERENCES "public"."titles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lists" ADD CONSTRAINT "lists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lists_user_idx" ON "lists" USING btree ("user_id");