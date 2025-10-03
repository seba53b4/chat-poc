import { desc, lt } from "drizzle-orm";
import db from "../db/index.js";
import { messages } from "../db/schema/messages.js";

export async function insertMessage({ userId, content }) {
  const [saved] = await db
    .insert(messages)
    .values({ userId, content })
    .returning();

  return saved;
}

export async function getRecentMessages(limit = 50, beforeId) {
  let builder = db.select().from(messages);

  if (beforeId !== undefined) {
    builder = builder.where(lt(messages.id, beforeId));
  }

  const rows = await builder
    .orderBy(desc(messages.createdAt))
    .limit(Number(limit))
    .execute();

  return rows;
}

export default { insertMessage, getRecentMessages };
