import express from "express";
import { health } from "../controllers/healthController.js";
import { listMessages, createMessage } from "../controllers/chatController.js";

const router = express.Router();

router.get("/health", health);
router.get("/messages", listMessages);
router.post("/messages", createMessage);

export default router;
