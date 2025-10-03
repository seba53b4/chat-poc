import { RoomMessageCreateSchema } from "../domain/message.js";
import { insertMessage, getRecentMessages } from "../dao/messageDAO.js";

export async function listMessages(req, res, next) {
  try {
    const roomCode = req.query.roomCode;
    if (!roomCode || typeof roomCode !== "string") {
      return res.status(400).json({ error: "roomCode query param is required" });
    }

    const limit = Number(req.query.limit || 50);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;
    const rows = await getRecentMessages(roomCode, limit, beforeId);
    return res.json(rows);
  } catch (e) {
    if (e instanceof Error && e.message === "Room not found") {
      return res.status(404).json({ error: "Room not found" });
    }
    return next(e);
  }
}

export async function createMessage(req, res, next) {
  try {
    const parsed = RoomMessageCreateSchema.parse(req.body);
    const saved = await insertMessage(parsed);
    return res.status(201).json(saved);
  } catch (e) {
    if (e instanceof Error && e.message === "Room not found") {
      return res.status(404).json({ error: "Room not found" });
    }
    return next(e);
  }
}

export default { listMessages, createMessage };
