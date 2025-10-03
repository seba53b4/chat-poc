import { Pool } from "pg";
import { error, log } from "../utils/logger.js";

export const pool = new Pool({
  host: process.env.PG_HOST,
  port: Number(process.env.PG_PORT || 5432),
  user: process.env.PG_USER,
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => error("PG pool error:", err));
pool.on("connect", () => log("PG connected"));

export default pool;
