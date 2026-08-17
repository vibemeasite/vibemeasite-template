CREATE TABLE "floating_widgets" (
	"id" text PRIMARY KEY NOT NULL,
	"cellpy_container_slug" text NOT NULL,
	"position" text NOT NULL,
	"device_visibility" text DEFAULT 'all' NOT NULL,
	"mode" text NOT NULL,
	"popup_target_container_slug" text,
	"popup_style" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
