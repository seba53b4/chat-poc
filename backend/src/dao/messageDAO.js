import { and, desc, eq, lt } from "drizzle-orm";
import db from "../db/index.js";
import { roomMessages } from "../db/schema/roomMessages.js";
import { findRoomByCode } from "./roomDAO.js";

export async function insertMessage({ roomCode, sender, content }) {
  const room = await findRoomByCode(roomCode);
  if (!room) {
    throw new Error("Room not found");
  }

  const [saved] = await db
    .insert(roomMessages)
    .values({ roomId: room.id, sender, content })
    .returning({
      id: roomMessages.id,
      roomId: roomMessages.roomId,
      sender: roomMessages.sender,
      content: roomMessages.content,
      createdAt: roomMessages.createdAt,
    });

  return { ...saved, roomCode };
}

export async function getRecentMessages(roomCode, limit = 50, beforeId) {
  const room = await findRoomByCode(roomCode);
  if (!room) {
    throw new Error("Room not found");
  }

  const filters = [eq(roomMessages.roomId, room.id)];
  if (beforeId !== undefined) {
    filters.push(lt(roomMessages.id, Number(beforeId)));
  }

  const whereClause = filters.length === 1 ? filters[0] : and(...filters);

  const rows = await db
    .select({
      id: roomMessages.id,
      roomId: roomMessages.roomId,
      sender: roomMessages.sender,
      content: roomMessages.content,
      createdAt: roomMessages.createdAt,
    })
    .from(roomMessages)
    .where(whereClause)
    .orderBy(desc(roomMessages.createdAt))
    .limit(Number(limit))
    .execute();

  return rows.map((row) => ({ ...row, roomCode }));
}

export default { insertMessage, getRecentMessages };
