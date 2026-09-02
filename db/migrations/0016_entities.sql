CREATE EXTENSION IF NOT EXISTS "pg_trgm";--> statement-breakpoint
CREATE TABLE "entities" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"plural_label" text,
	"fields" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"layout" text DEFAULT 'card' NOT NULL,
	"template" text,
	"page_size" integer DEFAULT 24 NOT NULL,
	"default_sort" text DEFAULT 'newest' NOT NULL,
	"one_per_user" boolean DEFAULT false NOT NULL,
	"moderation" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_slug" text NOT NULL,
	"data_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"search_text" text DEFAULT '' NOT NULL,
	"status" text DEFAULT 'published' NOT NULL,
	"created_by_user_id" text,
	"submitter_email" text,
	"lang" text DEFAULT 'en' NOT NULL,
	"sort_index" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_entity_slug_entities_slug_fk" FOREIGN KEY ("entity_slug") REFERENCES "public"."entities"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entries_entity_status_created_idx" ON "entries" ("entity_slug","status","created_at" DESC);--> statement-breakpoint
CREATE INDEX "entries_search_trgm_idx" ON "entries" USING gin ("search_text" gin_trgm_ops);
