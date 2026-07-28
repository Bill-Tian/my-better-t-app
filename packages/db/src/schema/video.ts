import { relations } from "drizzle-orm";
import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import { user } from "./auth";

export const videoGeneration = pgTable(
  "video_generation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    requestId: text("request_id").notNull(),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    mode: text("mode").notNull(),
    duration: integer("duration").notNull(),
    aspectRatio: text("aspect_ratio").notNull(),
    resolution: text("resolution").notNull(),
    status: text("status").notNull().default("pending"),
    progress: integer("progress").notNull().default(0),
    videoUrl: text("video_url"),
    fileId: text("file_id"),
    error: text("error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("video_generation_user_created_at_idx").on(
      table.userId,
      table.createdAt,
    ),
    uniqueIndex("video_generation_request_id_idx").on(table.requestId),
  ],
);

export const videoGenerationRelations = relations(
  videoGeneration,
  ({ one }) => ({
    user: one(user, {
      fields: [videoGeneration.userId],
      references: [user.id],
    }),
  }),
);
