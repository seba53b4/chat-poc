import { MessageSchema } from "../domain/message.js";
import { insertMessage, getRecentMessages } from "../dao/messageDAO.js";

export async function listMessages(req, res, next) {
  try {
    const limit = Number(req.query.limit || 50);
    const beforeId = req.query.beforeId ? Number(req.query.beforeId) : undefined;
    const rows = await getRecentMessages(limit, beforeId);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

export async function createMessage(req, res, next) {
  try {
    const parsed = MessageSchema.pick({ userId: true, content: true }).parse(
      req.body
    );
    const saved = await insertMessage(parsed);
    res.status(201).json(saved);
  } catch (e) {
    next(e);
  }
}

export default { listMessages, createMessage };
