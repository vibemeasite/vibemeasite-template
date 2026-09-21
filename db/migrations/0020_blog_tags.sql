-- Migration 0020: blog_tags table (BSA Phase 22 amendment — tags promoted
-- to a real taxonomy, same posture as blog_categories/0019). Hand-written,
-- no drizzle-kit snapshot, same as 0014-0015/0018-0019.
CREATE TABLE IF NOT EXISTS "blog_tags" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
