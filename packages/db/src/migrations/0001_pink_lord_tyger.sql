CREATE TABLE "video_generation" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"request_id" text NOT NULL,
	"prompt" text NOT NULL,
	"model" text NOT NULL,
	"mode" text NOT NULL,
	"duration" integer NOT NULL,
	"aspect_ratio" text NOT NULL,
	"resolution" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"video_url" text,
	"file_id" text,
	"error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_generation" ADD CONSTRAINT "video_generation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "video_generation_user_created_at_idx" ON "video_generation" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "video_generation_request_id_idx" ON "video_generation" USING btree ("request_id");