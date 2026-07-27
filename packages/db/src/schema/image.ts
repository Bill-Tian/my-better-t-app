import { relations } from "drizzle-orm";
import { index, integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

import { user } from "./auth";

export const imageGeneration = pgTable(
  "image_generation",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    prompt: text("prompt").notNull(),
    model: text("model").notNull(),
    size: text("size").notNull(),
    quality: text("quality").notNull(),
    quantity: integer("quantity").notNull(),
    background: text("background").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("image_generation_user_created_at_idx").on(table.userId, table.createdAt),
  ],
);

export const imageAsset = pgTable(
  "image_asset",
  {
    id: text("id").primaryKey(),
    generationId: text("generation_id")
      .notNull()
      .references(() => imageGeneration.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    mediaType: text("media_type").notNull(),
    base64: text("base64").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("image_asset_generation_position_idx").on(
      table.generationId,
      table.position,
    ),
  ],
);

export const imageGenerationRelations = relations(
  imageGeneration,
  ({ one, many }) => ({
    user: one(user, {
      fields: [imageGeneration.userId],
      references: [user.id],
    }),
    images: many(imageAsset),
  }),
);

export const imageAssetRelations = relations(imageAsset, ({ one }) => ({
  generation: one(imageGeneration, {
    fields: [imageAsset.generationId],
    references: [imageGeneration.id],
  }),
}));
