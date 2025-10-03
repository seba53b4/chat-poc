import { pgTable, bigserial, timestamp, varchar } from "drizzle-orm/pg-core";

export const rooms = pgTable("rooms", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  code: varchar("code", { length: 12 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
