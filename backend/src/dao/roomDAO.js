import { eq } from "drizzle-orm";
import db from "../db/index.js";
import { rooms } from "../db/schema/rooms.js";

const UNIQUE_VIOLATION = "23505";

export function randomRoomCode() {
  return Math.random().toString(36).substring(2, 8);
}

export async function createRoom() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomRoomCode();
    try {
      const [room] = await db
        .insert(rooms)
        .values({ code })
        .returning({
          id: rooms.id,
          code: rooms.code,
          createdAt: rooms.createdAt,
        });
      return room;
    } catch (error) {
      if (error?.code === UNIQUE_VIOLATION) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Unable to create room");
}

export async function findRoomByCode(code) {
  const [room] = await db
    .select({ id: rooms.id, code: rooms.code, createdAt: rooms.createdAt })
    .from(rooms)
    .where(eq(rooms.code, code))
    .limit(1)
    .execute();

  return room ?? null;
}

export default { createRoom, findRoomByCode };
