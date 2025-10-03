import { createAdapter } from "@socket.io/redis-adapter";
import { pub, sub } from "../db/redis.js";
import { insertMessage } from "../dao/messageDAO.js";
import { MessageSchema } from "../domain/message.js";
import { log } from "../utils/logger.js";

/**
 * Wire up Socket.IO and Redis so we can scale horizontally when needed.
 */
export function initSockets(io) {
  // Adapter for multiple instances (works fine with one instance too)
  io.adapter(createAdapter(pub, sub));

  io.on("connection", (socket) => {
    log("Socket connected", socket.id);

    socket.on("chat:send", async (payload, ack) => {
      try {
        const data = MessageSchema.pick({ userId: true, content: true }).parse(
          payload
        );
        const saved = await insertMessage(data);

        io.emit("chat:message", saved);
        if (ack) ack({ ok: true, message: saved });
      } catch (e) {
        if (ack) ack({ ok: false, error: e.message });
      }
    });

    socket.on("disconnect", () => {
      log("Socket disconnected", socket.id);
    });
  });
}

export default { initSockets };
