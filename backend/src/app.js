import express from "express";
import cors from "cors";
import routes from "./routes/index.js";
import { error } from "./utils/logger.js";
import "dotenv/config";

const app = express();

app.use(
  cors({
    origin: process.env.CORS_ORIGIN?.split(",") ?? "*",
  })
);
app.use(express.json());

app.use("/api", routes);

// Simple error handler so the user gets a JSON response
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  error(err);
  res.status(400).json({ error: err.message || "Bad Request" });
});

export default app;
