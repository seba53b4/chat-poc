# Chat POC

A proof of concept that combines a Node.js backend with a Vue 3 frontend to deliver a lightweight real-time chat experience. The app spins up ad-hoc chat rooms so people can share a short code and meet inside their own conversation.

## Architecture At A Glance
- **Backend (`/backend`)**: Express REST API plus Socket.IO gateway. Drizzle ORM sits on top of a shared `pg` pool to persist rooms and room-scoped messages. Redis powers the Socket.IO Redis adapter so additional backend instances can share events. The gateway exposes room lifecycle events (`room:create`, `room:join`, `room:participant-joined`) and chat messaging with ack payloads.
- **Frontend (`/frontend`)**: Vite + Vue 3 single-page client. It assigns each browser session a nickname, auto-rejoins the last room from session storage, fetches message history via REST, and maintains the live stream through Socket.IO.
- **Infrastructure**: Docker Compose spins up Postgres and Redis with local ports exposed (35432 and 36379 respectively). The schema lives in `backend/sql` for fast bootstrapping.

## Room Lifecycle Highlights
- Six-character lowercase room codes are generated server-side and persisted in Postgres to avoid collisions.
- When a room is created or joined, the server ensures the socket leaves any previous room before joining the new one, preventing cross-room leaks.
- Successful joins trigger a `room:participant-joined` broadcast so everyone refreshes the latest history and can react to new arrivals.
- The Vue client stores the room code in `sessionStorage`, replays the join handshake on reload, and clears the cache if the room no longer exists.
- Message sends receive ack responses from the backend, so the UI can surface delivery errors and keep the timeline ordered once the database write succeeds.

## Data Flow
1. The client waits for the Socket.IO connection, then calls `room:create` or `room:join` to obtain a room code and acknowledgement payload.
2. On success the backend joins the socket to the room, stores the provided nickname on the socket, and notifies peers via `room:participant-joined`.
3. The client hydrates the conversation by requesting `/api/messages?roomCode=XXXXXX` and caches the code locally for future sessions.
4. Outgoing chat submissions emit `chat:send`, the backend validates and saves through Drizzle, and the saved record is broadcast as `chat:message`.
5. When a new participant arrives the frontend silently reloads history, ensuring late entrants still see anything sent before they connected.

## Backend Details
- **Runtime**: Node 20+, ECMAScript modules throughout.
- **Frameworks**: Express 4, Socket.IO 4, Drizzle ORM (`drizzle-orm/node-postgres` driver), ioredis.
- **Schema**: `rooms` (code, createdAt) and `room_messages` (roomId FK, sender, content, createdAt) defined in `backend/src/db/schema` and created via `backend/sql/script-01.sql`.
- **Key Modules**:
  - `src/server.js` - entry point wiring HTTP, Socket.IO, Redis bootstrap, graceful shutdown.
  - `src/app.js` - Express app, JSON middleware, routes, and error handler.
  - `src/routes/index.js` - REST endpoints (`GET /api/health`, `GET/POST /api/messages`).
  - `src/sockets/index.js` - Socket.IO event wiring, ack helpers, room lifecycle broadcasts, and Redis adapter.
  - `src/dao/roomDAO.js` - room code generation plus persistence helpers.
  - `src/dao/messageDAO.js` - Drizzle-based inserts/selects scoped to a room.

## Frontend Details
- Generates a deterministic `user-xxxx` nickname per session and reuses a stored room code if one already exists.
- Presents a modern chat UI showing the active room code so it can be shared with other participants.
- Uses the `room:participant-joined` signal to silently refetch history and keep the timeline consistent even when someone joins late.
- Keeps message history in sync by combining REST for initial fetches with Socket.IO for live updates, including delivery ack handling.
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
  - `room:create` (client -> server) -> ack `{ ok, room: { id, code, createdAt } }`; the creating socket is auto-joined to the room.
  - `room:join` (client -> server) with `{ code, nickname }` -> ack `{ ok, room }` or `{ ok: false, error }`; joins the socket and persists the nickname on the connection.
  - `room:participant-joined` (server -> clients in room) -> `{ roomCode, nickname }` fired whenever a participant successfully joins.
  - `chat:send` (client -> server) with `{ roomCode, sender, content }` -> ack `{ ok, message }` or `{ ok: false, error }`.
  - `chat:message` (server -> clients in room) -> `{ id, roomId, roomCode, sender, content, createdAt }`.
- **REST**
  - `GET /api/health` -> `{ ok: true, uptime }`
  - `GET /api/messages?roomCode=XXXXXX&limit=50&beforeId=123` -> paginated history ordered by newest first
  - `POST /api/messages` -> `{ roomCode, sender, content }` for server-to-server or integration scenarios

## Development Tips
- Redis is required even for a single backend instance because the Socket.IO Redis adapter is preconfigured; make sure it is running before booting the server.
- Drizzle returns plain JavaScript objects, so DAOs simply attach `roomCode` for convenience.
- To smoke-test module loading without actually starting the HTTP server, import the subsystems directly, e.g. `node --input-type=module -e "await import('./src/dao/roomDAO.js')"` inside `backend/`.
- The Vue client will keep the previous room code in session storage; clear browser storage or click "Create new room" to start fresh.

## Ideas For Future Iterations
- Allow users to pick their nickname and persist it per room.
- Provide a tiny REST endpoint to list active rooms or invalidate empty ones.
- Replace the raw SQL migration with Drizzle kit migrations for better change tracking.
- Instrument logging/monitoring (e.g. pino + OpenTelemetry) to observe chat traffic in production scenarios.

Enjoy experimenting with the stack and feel free to extend it in any direction (presence indicators, message reactions, typing notifications, etc.).
