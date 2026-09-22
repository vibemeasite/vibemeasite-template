-- Migration 0022: site_settings.blog_style_config — owner-configurable
-- blog card/grid appearance (columns, card style, image visibility,
-- border radius, accent color, spacing), set via set_blog_style.
ALTER TABLE "site_settings" ADD COLUMN IF NOT EXISTS "blog_style_config" jsonb NOT NULL DEFAULT '{"columns":"auto","cardStyle":"bordered","showImage":true,"borderRadius":12,"accentColor":null,"spacing":"normal"}'::jsonb;
