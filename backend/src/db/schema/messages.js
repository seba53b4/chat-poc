import { pgTable, bigserial, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const messages = pgTable("messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  userId: varchar("user_id", { length: 64 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
