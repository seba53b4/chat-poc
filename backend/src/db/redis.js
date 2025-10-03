import Redis from "ioredis";
import { log, error } from "../utils/logger.js";

const baseConfig = {
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT || 6379),
  lazyConnect: true,
  enableReadyCheck: true,
  retryStrategy: (times) => Math.min(times * 50, 2000),
};

// Create a publisher and subscriber client as recommended by the adapter
export const pub = new Redis(baseConfig);
export const sub = new Redis(baseConfig);

pub.on("connect", () => log("Redis PUB connected"));
sub.on("connect", () => log("Redis SUB connected"));
pub.on("error", (e) => error("Redis PUB error", e));
sub.on("error", (e) => error("Redis SUB error", e));

export async function connectRedis() {
  if (!pub.status || pub.status === "wait") await pub.connect();
  if (!sub.status || sub.status === "wait") await sub.connect();
}

export const connect = connectRedis;

export default { pub, sub, connectRedis };
