import "dotenv/config";
import http from "http";
import { Server } from "socket.io";
import app from "./app.js";
import { initSockets } from "./sockets/index.js";
import { connectRedis } from "./db/redis.js";
import { pool } from "./db/index.js";
import { log, error } from "./utils/logger.js";

const PORT = Number(process.env.PORT || 3000);

async function bootstrap() {
  // asegura redis
  await connectRedis();

  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: process.env.CORS_ORIGIN?.split(",") ?? "*" },
  });

  initSockets(io);

  server.listen(PORT, () =>
    log(`HTTP + Socket.IO on http://localhost:${PORT}`)
  );

  // graceful shutdown
  function shutdown(sig) {
    log(`${sig} received, shutting down...`);
    server.close(() => {
      log("HTTP server closed");
      pool
        .end()
        .then(() => log("PG pool ended"))
        .catch(error);
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  }
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

bootstrap().catch((e) => {
  error("Bootstrap error", e);
  process.exit(1);
});
