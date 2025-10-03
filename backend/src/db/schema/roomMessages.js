import {
  pgTable,
  bigserial,
  text,
  timestamp,
  varchar,
  bigint as pgBigInt,
} from "drizzle-orm/pg-core";
import { rooms } from "./rooms.js";

export const roomMessages = pgTable("room_messages", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  roomId: pgBigInt("room_id", { mode: "number" })
    .references(() => rooms.id, { onDelete: "cascade" })
    .notNull(),
  sender: varchar("sender", { length: 64 }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
