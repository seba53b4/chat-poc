import { createAdapter } from "@socket.io/redis-adapter";
import { pub, sub } from "../db/redis.js";
import { insertMessage } from "../dao/messageDAO.js";
import { createRoom, findRoomByCode } from "../dao/roomDAO.js";
import { RoomMessageCreateSchema } from "../domain/message.js";
import { log } from "../utils/logger.js";

function safeAck(ack, payload) {
  if (typeof ack === "function") {
    ack(payload);
  }
}

function leaveJoinedRooms(socket) {
  for (const roomName of socket.rooms) {
    if (roomName !== socket.id) {
      socket.leave(roomName);
    }
  }
}

/**
 * Wire up Socket.IO and Redis so we can scale horizontally when needed.
 */
export function initSockets(io) {
  io.adapter(createAdapter(pub, sub));

  io.on("connection", (socket) => {
    log("Socket connected", socket.id);

    socket.on("room:create", async (ack) => {
      try {
        const room = await createRoom();
        leaveJoinedRooms(socket);
        socket.join(room.code);
        safeAck(ack, { ok: true, room });
      } catch (error) {
        safeAck(ack, {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to create room",
        });
      }
    });

    socket.on("room:join", async ({ code, nickname }, ack) => {
      try {
        if (!code) {
          return safeAck(ack, { ok: false, error: "Room code is required" });
        }
        const room = await findRoomByCode(code);
        if (!room) {
          return safeAck(ack, { ok: false, error: "Room not found" });
        }
        leaveJoinedRooms(socket);
        socket.join(room.code);
        const trimmedNickname = typeof nickname === "string" ? nickname.trim() : "";
        if (trimmedNickname) {
          socket.data.nickname = trimmedNickname;
        }
        const displayName = socket.data.nickname ?? trimmedNickname ?? null;
        socket.to(room.code).emit("room:participant-joined", {
          roomCode: room.code,
          nickname: displayName,
        });
        return safeAck(ack, { ok: true, room });
      } catch (error) {
        return safeAck(ack, {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to join room",
        });
      }
    });

    socket.on("chat:send", async (payload, ack) => {
      try {
        const data = RoomMessageCreateSchema.parse(payload);
        const saved = await insertMessage(data);
        io.to(data.roomCode).emit("chat:message", saved);
        safeAck(ack, { ok: true, message: saved });
      } catch (error) {
        safeAck(ack, {
          ok: false,
          error: error instanceof Error ? error.message : "Unable to send message",
        });
      }
    });

    socket.on("disconnect", () => {
      log("Socket disconnected", socket.id);
    });
  });
}

export default { initSockets };
