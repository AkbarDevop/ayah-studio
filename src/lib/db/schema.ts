import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  real,
  integer,
} from "drizzle-orm/pg-core";

export const projects = pgTable("projects", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: text("user_id").notNull(),
  name: text("name").notNull().default("Untitled Project"),

  // Quran selection
  surahNumber: integer("surah_number"),
  startAyah: integer("start_ayah"),
  endAyah: integer("end_ayah"),
  translationEdition: text("translation_edition").default("en.sahih"),

  // Media
  videoUrl: text("video_url"),
  youtubeUrl: text("youtube_url"),
  mediaDuration: real("media_duration"),

  // Subtitle data (full array as JSON)
  subtitles: jsonb("subtitles").default([]),

  // Style
  subtitleStyle: text("subtitle_style").default("shadow"),
  subtitleFormatting: jsonb("subtitle_formatting").default({}),
  subtitlePlacement: jsonb("subtitle_placement").default({ x: 0.5, y: 0.78 }),
  aspectRatio: text("aspect_ratio").default("landscape"),

  // Metadata
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
