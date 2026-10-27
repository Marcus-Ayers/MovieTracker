ALTER TABLE "users" ADD COLUMN "rate_prompt" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "rate_prompt_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "viewings" ADD COLUMN "skip_rating" boolean DEFAULT false NOT NULL;