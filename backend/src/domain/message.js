import { z } from "zod";

export const MessageSchema = z.object({
  id: z.number().int().positive().optional(),
  userId: z.string().min(1).max(64),
  content: z.string().min(1).max(5000),
  createdAt: z.date().optional(),
});

export default MessageSchema;
