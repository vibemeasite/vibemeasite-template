-- Migration 0021: site_settings.blog_filter_config (BSA Phase 22 amendment)
-- — owner-configurable search/tag/category filter widget on the blog
-- index. Hand-written, no drizzle-kit snapshot, same as 0014-0015/0018-0020.
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "blog_filter_config" jsonb NOT NULL DEFAULT '{"enabled":false,"showSearch":true,"showCategories":true,"showTags":true}'::jsonb;
