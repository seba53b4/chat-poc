import { z } from "zod";

export const RoomMessageSchema = z.object({
  id: z.number().int().positive().optional(),
  roomId: z.number().int().positive().optional(),
  roomCode: z.string().min(3).max(12),
  sender: z.string().min(1).max(64),
  content: z.string().min(1).max(5000),
  createdAt: z.coerce.date().optional(),
});

export const RoomMessageCreateSchema = RoomMessageSchema.pick({
  roomCode: true,
  sender: true,
  content: true,
});

export default RoomMessageSchema;
