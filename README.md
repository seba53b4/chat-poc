# Chat POC

A proof of concept that combines a Node.js backend with a Vue 3 frontend to deliver a lightweight real-time chat experience. The app now spins up ad-hoc chat rooms so people can share a short code and meet inside their own conversation.

## Architecture At A Glance
- **Backend (`/backend`)**: Express REST API plus Socket.IO gateway. Drizzle ORM sits on top of a shared `pg` pool to persist rooms and room-scoped messages. Redis powers the Socket.IO Redis adapter so additional backend instances can share events.
- **Frontend (`/frontend`)**: Vite + Vue 3 single-page client. It boots a private room (or rejoins one from session storage), fetches message history via REST, and maintains the live stream through Socket.IO.
- **Infrastructure**: Docker Compose spins up Postgres and Redis with local ports exposed (35432 and 36379 respectively). The schema lives in `backend/sql` for fast bootstrapping.

## Data Flow
1. The Vue client requests/creates a room by calling the `room:create` or `room:join` Socket.IO events.
2. Once inside a room, the client fetches `/api/messages?roomCode=XXXXXX` to display the latest history.
3. When a user submits a message, the frontend emits `chat:send` with `{ roomCode, sender, content }`.
4. The backend validates the payload, writes it through Drizzle into `room_messages`, and emits `chat:message` to the sockets that joined that room.
5. Every participant in the room receives the event and updates their timeline in place.

## Backend Details
- **Runtime**: Node 20+, ECMAScript modules throughout.
- **Frameworks**: Express 4, Socket.IO 4, Drizzle ORM (`drizzle-orm/node-postgres` driver), ioredis.
- **Schema**: `rooms` (code, createdAt) and `room_messages` (roomId FK, sender, content, createdAt) defined in `backend/src/db/schema` and created via `backend/sql/script-01.sql`.
- **Key Modules**:
  - `src/server.js` - entry point wiring HTTP, Socket.IO, graceful shutdown.
  - `src/app.js` - Express app, JSON middleware, routes, and error handler.
  - `src/routes/index.js` - REST endpoints (`GET /api/health`, `GET/POST /api/messages`).
  - `src/sockets/index.js` - Socket.IO events (room lifecycle + chat) plus Redis adapter.
  - `src/dao/roomDAO.js` - room creation and lookup utilities.
  - `src/dao/messageDAO.js` - Drizzle-based inserts/selects scoped to a room.
  - `src/db/index.js` - central Drizzle instance and schema exports.

## Frontend Details
- Generates a random nickname per session and reuses a stored room code if one already exists.
- Presents a modern chat UI inspired by common support widgets, showing the room code so it can be shared.
- Keeps message history in sync by combining REST for initial fetches with Socket.IO for live updates.
- Source lives under `frontend/src` with the main UI in `App.vue`.

## Getting Started Locally
1. **Install dependencies**
   ```bash
   cd backend && npm install
   cd ../frontend && npm install
   ```
2. **Prepare environment variables**
   ```bash
   cd ../backend
   cp .env.example .env
   ```
3. **Start infrastructure**
   ```bash
   cd ..
   docker compose up -d
   ```
4. **Apply database schema** (if running for the first time)
   ```bash
   cd backend
   psql "$PG_URI" -f sql/script-01.sql
   ```
5. **Run the backend**
   ```bash
   npm run dev
   ```
6. **Run the frontend**
   ```bash
   cd ../frontend
   npm run dev
   ```
7. Open the Vite URL (default `http://localhost:5173`). The backend listens on `http://localhost:3000` by default.

## Socket Events & REST API
- **Socket.IO**
  - `room:create` (client -> server) -> ack `{ ok, room: { id, code, createdAt } }`
  - `room:join` (client -> server) with `{ code, nickname }` -> ack `{ ok, room }` or error
  - `chat:send` (client -> server) with `{ roomCode, sender, content }`
  - `chat:message` (server -> clients in room) -> `{ id, roomId, roomCode, sender, content, createdAt }`
- **REST**
  - `GET /api/health` -> `{ ok: true, uptime }`
  - `GET /api/messages?roomCode=XXXXXX&limit=50&beforeId=123` -> paginated history ordered by newest first
  - `POST /api/messages` -> `{ roomCode, sender, content }` for server-to-server or integration scenarios

## Development Tips
- Redis is required even for a single backend instance because the Socket.IO Redis adapter is preconfigured; make sure it is running before booting the server.
- Drizzle returns plain JavaScript objects, so DAOs simply attach `roomCode` for convenience.
- To smoke-test module loading without actually starting the HTTP server, import the subsystems directly, e.g. `node --input-type=module -e "await import('./src/dao/roomDAO.js')"` inside `backend/`.

## Ideas For Future Iterations
- Allow users to pick their nickname and persist it per room.
- Provide a tiny REST endpoint to list active rooms or invalidate empty ones.
- Replace the raw SQL migration with Drizzle kit migrations for better change tracking.
- Instrument logging/monitoring (e.g. pino + OpenTelemetry) to observe chat traffic in production scenarios.

Enjoy experimenting with the stack and feel free to extend it in any direction (presence indicators, message reactions, typing notifications, etc.).
